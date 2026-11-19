"""Real existing LangChain adapter and graph against mocked HTTP, never external keys."""

import asyncio
import json

import httpx
import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage

import agent.runtime as runtime
from agent.provider import GROQ_ORIGIN, client, configuration, request_options


@pytest.fixture(autouse=True)
def groq(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_fixture_123456789_PRIVATE")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")
    monkeypatch.delenv("GROQ_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_MAX_OUTPUT_TOKENS", raising=False)
    monkeypatch.setattr(runtime, "LAST_CONNECTION", "NOT_CHECKED")


def body():
    return runtime.AgentRequest(
        messages=[{"role": "USER", "content": "Analyze my hardware"}],
        grant="a" * 43,
        csrf="fixture-csrf",
    )


def test_configuration_and_no_credentials_in_repr(monkeypatch):
    config = configuration()
    assert config.base_url == GROQ_ORIGIN and config.output_tokens == 2048
    assert config.key not in repr(config)
    monkeypatch.delenv("GROQ_API_KEY")
    assert configuration() is None and not runtime.status()["configured"]


@pytest.mark.parametrize(
    "key,value",
    [
        ("GROQ_BASE_URL", "https://attacker.invalid/openai/v1"),
        ("GROQ_BASE_URL", "https://api.groq.com/openai/v1?key=secret"),
        ("LLM_MAX_OUTPUT_TOKENS", "999999"),
        ("LLM_MAX_OUTPUT_TOKENS", "not-a-number"),
        ("LLM_PROVIDER", "unsupported"),
    ],
)
def test_invalid_configuration_fails_closed(monkeypatch, key, value):
    monkeypatch.setenv(key, value)
    with pytest.raises(ValueError):
        configuration()


def test_official_compatible_request_parameters_and_tool_parsing():
    seen = []

    def response(request):
        seen.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "id": "fixture",
                "object": "chat.completion",
                "created": 1,
                "model": "openai/gpt-oss-120b",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls",
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {"name": "get_hardware_profile", "arguments": "{}"},
                                }
                            ],
                        },
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            },
        )

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as http:
            config = configuration()
            llm = client(config, http)
            result = await llm.bind_tools(runtime.tools()).ainvoke(
                [HumanMessage(content="Hardware")], **request_options(config, routing=True)
            )
            assert result.tool_calls[0]["name"] == "get_hardware_profile"
            assert result.usage_metadata["total_tokens"] == 15

    asyncio.run(run())
    sent = seen[0]
    assert sent["max_completion_tokens"] == 2048 and "max_tokens" not in sent
    assert sent["temperature"] == 0.1 and sent["include_reasoning"] is False
    assert sent["parallel_tool_calls"] is False and "reasoning_format" not in sent
    assert "gsk_" not in json.dumps(sent) and len(sent["tools"]) == 20


@pytest.mark.parametrize(
    "status,expected",
    [
        (401, "PROVIDER_AUTH"),
        (403, "PROVIDER_AUTH"),
        (429, "PROVIDER_RATE_LIMIT"),
        (404, "PROVIDER_MODEL"),
        (400, "PROVIDER_INCOMPATIBLE"),
        (500, "AGENT_FAILED"),
    ],
)
def test_upstream_failures_are_safe(monkeypatch, status, expected):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    status,
                    json={
                        "error": {"message": "gsk_fixture_123456789_PRIVATE secret upstream body"}
                    },
                )
            )
        ) as http:
            monkeypatch.setattr(runtime, "provider", lambda: client(configuration(), http))
            output = [e async for e in runtime.events(body())]
            assert output[-1]["code"] == expected
            assert "PRIVATE" not in json.dumps(output) and "upstream body" not in json.dumps(output)

    asyncio.run(run())


@pytest.mark.parametrize("kind", ["timeout", "network", "malformed"])
def test_network_timeout_and_malformed_responses(monkeypatch, kind):
    def response(request):
        if kind == "timeout":
            raise httpx.ReadTimeout("private detail", request=request)
        if kind == "network":
            raise httpx.ConnectError("private detail", request=request)
        return httpx.Response(200, json={"unexpected": "private detail"})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as http:
            monkeypatch.setattr(runtime, "provider", lambda: client(configuration(), http))
            output = [e async for e in runtime.events(body())]
            assert output[-1]["type"] == "error"
            assert "private detail" not in json.dumps(output)

    asyncio.run(run())


def test_real_chunk_emission_precedes_completion_and_masks_split_secrets():
    async def run():
        released = asyncio.Event()

        class Model:
            def bind_tools(self, _tools):
                return self

            async def ainvoke(self, _messages, **_kwargs):
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "get_hardware_profile",
                            "args": {},
                            "id": "call",
                            "type": "tool_call",
                        }
                    ],
                )

            async def astream(self, _messages, **_kwargs):
                yield AIMessageChunk(content="MEASURED evidence. " * 50 + "gsk_fixture_")
                await released.wait()
                yield AIMessageChunk(content="123456789_PRIVATE final answer.")

        async def execute(*_args):
            return {"available": True, "data": {}, "references": []}

        output = []
        async for event in runtime.events(body(), llm=Model(), execute=execute):
            output.append(event)
            if event["type"] == "chunk":
                released.set()
        assert released.is_set() and output[-1]["type"] == "complete"
        assert "gsk_fixture" not in json.dumps(output)
        assert "final answer" in json.dumps(output)

    asyncio.run(run())


def test_hidden_reasoning_and_split_redaction():
    stream = runtime.StreamingRedactor()
    text = stream.feed("gsk_fixture_") + stream.feed("123456789_PRIVATE", final=True)
    assert "PRIVATE" not in text
    with pytest.raises(runtime.AgentError, match="reasoning"):
        runtime.StreamingRedactor().feed("<think>hidden reasoning</think>", final=True)


def test_provider_stream_interruption_retains_safe_error(monkeypatch):
    class Broken(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield (
                "data: "
                + json.dumps(
                    {
                        "id": "fixture",
                        "object": "chat.completion.chunk",
                        "created": 1,
                        "model": "openai/gpt-oss-120b",
                        "choices": [
                            {"index": 0, "delta": {"content": "partial"}, "finish_reason": None}
                        ],
                    }
                )
                + "\n\n"
            ).encode()
            raise httpx.ReadError("sensitive upstream interruption")

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, headers={"content-type": "text/event-stream"}, stream=Broken()
                )
            )
        ) as http:
            async for _chunk in client(configuration(), http).astream(
                [HumanMessage(content="hello")], **request_options(configuration())
            ):
                pass

    with pytest.raises(Exception) as error:
        asyncio.run(run())
    from agent.provider import safe_failure

    code, message = safe_failure(error.value)
    assert code in {"PROVIDER_NETWORK", "AGENT_FAILED"}
    assert "sensitive" not in message
