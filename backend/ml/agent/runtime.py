"""Small auditable LangGraph; runtime credentials never enter model messages."""

import asyncio
import json
import os
import re
from pathlib import Path
from typing import TypedDict

import httpx
import tiktoken
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict, Field

from .provider import client as provider_client
from .provider import configuration, request_options, safe_failure

MAX_TOOLS = 6
MAX_ROUNDS = 2
MAX_OUTPUT = 1024
TIMEOUT = 75
TOOL_TIMEOUT = 20
LAST_CONNECTION = "NOT_CHECKED"
UNAVAILABLE = "AI Assistant unavailable — configure an LLM provider."
SYSTEM = (Path(__file__).with_name("system-prompt.md")).read_text(encoding="utf-8")

DESCRIPTIONS = {
    "search_corewise_knowledge": (
        "Semantic supporting documentation with actual citations. query required, limit 1-6. "
        "Optional sourceType. Never authoritative numerical benchmark retrieval."
    ),
    "list_hardware_profiles": "Owned profiles with detection/manual provenance (limit 1–10).",
    "get_hardware_profile": "Get owned profile by id; omit id for selected/default profile.",
    "list_workloads": "List owned saved workloads (limit 1–10).",
    "get_workload": "Get owned workload by id, selected workload, or latest if none selected.",
    "get_analytical_comparison": "Get owned saved ANALYTICAL comparison by id or latest.",
    "run_analytical_estimate": "Read-only existing M2 estimator using saved workload assumptions.",
    "list_active_models": "Active owned CPU/GPU model versions and training provenance.",
    "get_ml_prediction": "Owned saved PREDICTED result by id or latest; includes model sources.",
    "run_ml_prediction": "Read-only real M3 inference using saved assumptions and active models.",
    "list_benchmark_runs": "MEASURED runs with correctness and timing scopes (limit 1–10).",
    "get_benchmark_run": "Get owned measured run by id or latest. Does NOT execute a benchmark.",
    "get_prediction_explanation": "M5 local SHAP in ln(ms). id is prediction ID; omit for latest.",
    "get_global_feature_importance": "Saved M5 global SHAP. id is model ID; omit for latest.",
    "get_hardware_connection": "Selected-profile FRESH/STALE telemetry. Stale data withheld.",
    "preview_optimization": (
        "Read-only CPU/GPU decision, compatible benchmark errors, analytical crossover, "
        "overhead, thread observations and limits. Saved workload/hardware; optional "
        "predictionId/benchmarkId. No execution or writes."
    ),
    "list_reports": "List owned saved report summaries and authorized navigation (limit 1–10).",
    "get_report": "Get owned report summary by id or latest. Does not generate a report.",
    "list_datasets": "Owned dataset counts, families, hardware IDs and provenance (limit 1–10).",
    "get_dataset": "Owned dataset metadata by id or latest. No raw training rows.",
}


class AgentError(ValueError):
    """Safe application-authored messages; upstream exception bodies remain private."""


class StreamingRedactor:
    """Bounded lookbehind; never emit a cut inside a credential match or token."""

    def __init__(self):
        self.pending = ""
        self.secrets = [
            os.getenv(k, "")
            for k in (
                "LLM_API_KEY",
                "GROQ_API_KEY",
                "ML_INTERNAL_TOKEN",
                "SESSION_SECRET",
                "DATABASE_URL",
                "DIRECT_URL",
                "NEON_API_KEY",
            )
            if len(os.getenv(k, "")) >= 8
        ]
        self.hold = max([256] + [len(s) + 128 for s in self.secrets])

    def feed(self, text, final=False):
        self.pending += text
        if re.search(r"<\s*think(?:>|\s)", self.pending, re.I):
            raise AgentError("Provider returned unsupported reasoning content")
        if final:
            result, self.pending = redact(self.pending), ""
            return result
        bound = len(self.pending) - self.hold
        if bound <= 0:
            return ""
        boundaries = list(re.finditer(r"\s", self.pending[:bound]))
        cut = boundaries[-1].end() if boundaries else 0
        patterns = [
            r"\bBearer\s+[^\s]+",
            r"\b(?:sk-|gsk_)[A-Za-z0-9_-]+",
            r"\b(?:password|api[_ -]?key|token|secret|cookie|authorization)\s*[:=]\s*[^\s,;]+",
        ]
        for pattern in patterns + [re.escape(s) for s in self.secrets]:
            for match in re.finditer(pattern, self.pending, re.I):
                if match.start() < cut < match.end():
                    cut = match.start()
        result = redact(self.pending[:cut])
        self.pending = self.pending[cut:]
        return result


def tools():
    result = []
    for name, description in DESCRIPTIONS.items():
        properties = (
            {"limit": {"type": "integer", "minimum": 1, "maximum": 10}}
            if name.startswith("list_")
            else {
                "workloadId": {"type": "string", "maxLength": 100},
                "hardwareProfileId": {"type": "string", "maxLength": 100},
            }
            if name.startswith("run_") or name == "preview_optimization"
            else {"id": {"type": "string", "maxLength": 100}}
        )
        if name == "preview_optimization":
            properties.update(
                {k: {"type": "string", "maxLength": 100} for k in ["predictionId", "benchmarkId"]}
            )
        if name == "search_corewise_knowledge":
            properties = {
                "query": {"type": "string", "minLength": 2, "maxLength": 1000},
                "limit": {"type": "integer", "minimum": 1, "maximum": 6},
                "sourceType": {
                    "type": "string",
                    "enum": ["NOTE", "REPORT", "WORKLOAD", "PROJECT_DOCUMENTATION"],
                },
            }
        if name == "get_hardware_connection":
            properties = {}
        result.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": description,
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "additionalProperties": False,
                        **({"required": ["query"]} if name == "search_corewise_knowledge" else {}),
                    },
                },
            }
        )
    return result


def redact(text):
    text = re.sub(r"\bBearer\s+[A-Za-z0-9._~-]+", "Bearer [REDACTED]", text, flags=re.I)
    text = re.sub(r"\b(?:sk-|gsk_)[A-Za-z0-9_-]{8,}", "[REDACTED]", text)
    text = re.sub(
        r"\b(password|api[_ -]?key|token|secret|cookie|authorization)\s*[:=]\s*[^\s,;]+",
        r"\1=[REDACTED]",
        text,
        flags=re.I,
    )
    for key in [
        "LLM_API_KEY",
        "GROQ_API_KEY",
        "ML_INTERNAL_TOKEN",
        "SESSION_SECRET",
        "DATABASE_URL",
        "DIRECT_URL",
        "NEON_API_KEY",
    ]:
        value = os.environ.get(key, "")
        if len(value) >= 8:
            text = text.replace(value, "[REDACTED]")
    return text


def status():
    config = configuration()
    return {
        "configured": config is not None,
        "connection": LAST_CONNECTION if config else "UNCONFIGURED",
        "provider": config.name if config else None,
        "model": config.model if config else None,
        "message": "Provider configured; connection checked on request." if config else UNAVAILABLE,
        "limits": {
            "toolCalls": MAX_TOOLS,
            "iterations": 8,
            "contextMessages": 10,
            "outputTokens": config.output_tokens if config else MAX_OUTPUT,
            "timeoutSeconds": TIMEOUT,
        },
    }


def clean(value):
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, list):
        return [clean(item) for item in value]
    if isinstance(value, dict):
        return {
            key: "[REDACTED]"
            if re.fullmatch(
                r"password|api_?key|authorization|cookie|token|secret|grant|csrf", key, re.I
            )
            else clean(item)
            for key, item in value.items()
        }
    return value


class Context(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hardwareProfileId: str | None = Field(default=None, max_length=100)
    workloadId: str | None = Field(default=None, max_length=100)


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: str = Field(pattern="^(USER|ASSISTANT)$")
    content: str = Field(max_length=4000)


class AgentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[Message] = Field(min_length=1, max_length=10)
    context: Context = Field(default_factory=Context)
    grant: str = Field(min_length=32, max_length=100)
    csrf: str = Field(min_length=1, max_length=256)


class State(TypedDict):
    messages: list
    calls: int
    rounds: int
    tool_chars: int
    usage: dict


def add_usage(first, second):
    return {
        "reported": bool(second) or first.get("reported", False),
        **{
            key: first.get(key, 0) + (second or {}).get(key, 0)
            for key in ["input_tokens", "output_tokens", "total_tokens"]
        },
    }


def check_context(messages):
    # Explicit bounded serialization, not unlimited history/checkpoint replay.
    text = json.dumps([m.model_dump(include={"content", "tool_calls"}) for m in messages])
    if len(tiktoken.get_encoding("cl100k_base").encode(text)) > 12000:
        raise AgentError("Agent context token budget exceeded; start a smaller conversation")


def provider():
    config = configuration()
    if not config:
        raise AgentError(UNAVAILABLE)
    return provider_client(config)


def build_graph(llm, execute, config=None):
    async def router(state):
        check_context(state["messages"])
        response = await llm.bind_tools(tools()).ainvoke(
            state["messages"], **request_options(config, routing=True)
        )
        if response.invalid_tool_calls:
            raise AgentError("Provider returned invalid tool arguments")
        if len(response.tool_calls) + state["calls"] > MAX_TOOLS:
            raise AgentError("Agent tool-call budget exceeded")
        return {
            "messages": state["messages"] + [response],
            "rounds": state["rounds"] + 1,
            "usage": add_usage(state["usage"], response.usage_metadata),
        }

    async def tool_execution(state):
        messages = list(state["messages"])
        count, size = state["calls"], state["tool_chars"]
        writer = get_stream_writer()
        for call in messages[-1].tool_calls:
            name = call["name"]
            if name not in DESCRIPTIONS:
                raise AgentError("Tool is not allowlisted")
            count += 1
            writer({"type": "tool", "name": name, "status": "STARTED"})
            try:
                result = await asyncio.wait_for(execute(name, call["args"]), timeout=TOOL_TIMEOUT)
            except TimeoutError:
                result = {
                    "available": False,
                    "provenance": "UNAVAILABLE",
                    "units": {},
                    "references": [],
                    "data": None,
                    "notice": "Tool execution timed out",
                }
            result = clean(result)
            payload = json.dumps(result)
            size += len(payload)
            if size > 32000:
                raise AgentError("Agent tool-result context budget exceeded")
            writer(
                {
                    "type": "tool",
                    "name": name,
                    "status": "COMPLETED" if result.get("available") else "FAILED",
                    "result": result,
                }
            )
            messages.append(ToolMessage(content=payload, tool_call_id=call["id"]))
        return {"messages": messages, "calls": count, "tool_chars": size}

    async def response_generation(state):
        check_context(state["messages"])
        messages = state["messages"]
        writer = get_stream_writer()
        sanitizer = StreamingRedactor()
        text, usage = "", None
        if isinstance(messages[-1], AIMessage) and not messages[-1].tool_calls:
            # Genuine non-streamed routing response; do not manufacture token chunks.
            text = messages[-1].text
            safe = sanitizer.feed(text, final=True)
            if safe:
                writer({"type": "chunk", "text": safe})
            usage = state["usage"]
        else:
            async for chunk in llm.astream(messages, **request_options(config)):
                text += chunk.text
                usage = chunk.usage_metadata or usage
                if len(text) > 16000:
                    raise AgentError("Agent response length budget exceeded")
                safe = sanitizer.feed(chunk.text)
                if safe:
                    writer({"type": "chunk", "text": safe})
            safe = sanitizer.feed("", final=True)
            if safe:
                writer({"type": "chunk", "text": safe})
            usage = add_usage(state["usage"], usage)
        if not text.strip():
            raise AgentError("Provider returned no response text")
        if len(text) > 16000:
            raise AgentError("Agent response length budget exceeded")
        writer(
            {
                "type": "metadata",
                "provider": config.name if config else "openai-compatible",
                "model": config.model if config else status()["model"] or "test-provider",
                "usage": usage,
            }
        )
        return {}

    def after_router(state):
        return "tools" if state["messages"][-1].tool_calls else "response"

    graph = StateGraph(State)
    graph.add_node("router", router)
    graph.add_node("tools", tool_execution)
    graph.add_node("response", response_generation)
    graph.add_edge(START, "router")
    graph.add_conditional_edges("router", after_router)
    graph.add_conditional_edges(
        "tools",
        lambda s: "router" if s["rounds"] < MAX_ROUNDS and s["calls"] < MAX_TOOLS else "response",
    )
    graph.add_edge("response", END)
    return graph.compile()


async def events(body, llm=None, execute=None):
    global LAST_CONNECTION
    try:
        model = llm or provider()
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:

            async def callback(name, arguments):
                response = await client.post(
                    os.environ.get("AGENT_API_ORIGIN", "http://127.0.0.1:4000")
                    + "/internal/agent/tools",
                    headers={
                        "Authorization": "Bearer " + os.environ.get("ML_INTERNAL_TOKEN", ""),
                        "x-agent-grant": body.grant,
                        "x-csrf-token": body.csrf,
                    },
                    json={"name": name, "arguments": arguments},
                )
                if not response.is_success:
                    return {
                        "available": False,
                        "provenance": "UNAVAILABLE",
                        "units": {},
                        "references": [],
                        "data": None,
                        "notice": "Authorized tool unavailable or input invalid",
                    }
                return response.json()

            graph = build_graph(
                model, execute or callback, configuration() if llm is None else None
            )
            messages = [
                SystemMessage(content=SYSTEM),
                HumanMessage(
                    content="Untrusted selected context: "
                    + body.context.model_dump_json(exclude_none=True)
                ),
            ]
            messages += [
                (HumanMessage if m.role == "USER" else AIMessage)(content=redact(m.content))
                for m in body.messages
            ]
            finished = False
            async with asyncio.timeout(TIMEOUT):
                async for event in graph.astream(
                    {"messages": messages, "calls": 0, "rounds": 0, "tool_chars": 0, "usage": {}},
                    config={"recursion_limit": 8},
                    stream_mode="custom",
                ):
                    if event["type"] == "metadata":
                        finished = True
                        if llm is None:
                            LAST_CONNECTION = "CONNECTED"
                    yield event
            if not finished:
                raise AgentError("Agent graph ended without a response")
        yield {"type": "complete"}
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        if llm is None and status()["configured"]:
            LAST_CONNECTION = "ERROR"
        # Never stream provider exceptions: upstream errors may contain URLs/credentials/bodies.
        unavailable = str(exc) == UNAVAILABLE
        safe = str(exc) if isinstance(exc, AgentError) else safe_failure(exc)[1]
        yield {
            "type": "error",
            "code": "PROVIDER_UNAVAILABLE"
            if unavailable
            else ("AGENT_FAILED" if isinstance(exc, AgentError) else safe_failure(exc)[0]),
            "message": redact(safe)[:300],
        }
