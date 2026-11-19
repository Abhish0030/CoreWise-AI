"""One existing LangChain client, with provider-specific validated server configuration."""

import os
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from langchain_openai import ChatOpenAI
from openai import APIConnectionError, APIStatusError, APITimeoutError

GROQ_ORIGIN = "https://api.groq.com/openai/v1"


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    key: str = field(repr=False)
    model: str
    base_url: str | None
    output_tokens: int


def configuration():
    name = os.getenv("LLM_PROVIDER", "").strip()
    if not name:
        return None
    if name not in {"groq", "openai-compatible"}:
        raise ValueError("LLM_PROVIDER must be groq or openai-compatible")
    groq = name == "groq"
    key = os.getenv("GROQ_API_KEY" if groq else "LLM_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b") if groq else os.getenv("LLM_MODEL", "")
    base = os.getenv("GROQ_BASE_URL", GROQ_ORIGIN) if groq else os.getenv("LLM_BASE_URL")
    if base:
        url = urlsplit(base)
        if url.username or url.password or url.query or url.fragment:
            raise ValueError("Provider URL cannot contain credentials, query or fragment")
        if groq and base.rstrip("/") != GROQ_ORIGIN:
            raise ValueError("Groq credentials may only be sent to the official Groq API")
        if url.scheme != "https" and not (
            url.scheme == "http" and url.hostname in {"127.0.0.1", "localhost", "::1"}
        ):
            raise ValueError("Remote provider URLs require HTTPS")
    try:
        limit = int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "2048" if groq else "1024"))
    except ValueError as exc:
        raise ValueError("LLM_MAX_OUTPUT_TOKENS must be an integer") from exc
    if not 256 <= limit <= 8192:
        raise ValueError("LLM_MAX_OUTPUT_TOKENS must be between 256 and 8192")
    if not key or not model or key.startswith(("replace-with-", "configure-")):
        return None
    return ProviderConfig(name, key, model.strip(), base, limit)


def client(config, http_async_client=None):
    options = dict(
        model=config.model,
        api_key=config.key,
        base_url=config.base_url,
        timeout=25,
        max_retries=0,
        temperature=0.1,
        stream_usage=True,
        use_responses_api=False,
    )
    if http_async_client is not None:
        options["http_async_client"] = http_async_client
    if config.name == "groq":
        # Groq GPT-OSS does not accept reasoning_format. Do not request reasoning text.
        options["extra_body"] = (
            {"include_reasoning": False} if config.model.startswith("openai/gpt-oss-") else {}
        )
        if config.model.startswith("openai/gpt-oss-"):
            options["reasoning_effort"] = "low"
    return ChatOpenAI(**options)


def request_options(config=None, routing=False):
    limit = config.output_tokens if config else 1024
    if config and config.name == "groq":
        return {"max_completion_tokens": limit, "parallel_tool_calls": False}
    return {"max_tokens": min(limit, 256) if routing else limit}


def safe_failure(error):
    if isinstance(error, (APITimeoutError, TimeoutError)):
        return "PROVIDER_TIMEOUT", "Provider timed out. Retry this message."
    if isinstance(error, APIConnectionError):
        return "PROVIDER_NETWORK", "Provider network connection failed. Retry later."
    if isinstance(error, APIStatusError):
        code = error.status_code
        if code in {401, 403}:
            return "PROVIDER_AUTH", "Provider rejected its credentials or model permissions."
        if code == 429:
            return "PROVIDER_RATE_LIMIT", "Provider rate limit reached. Wait before retrying."
        if code == 404:
            return "PROVIDER_MODEL", "Configured provider model is unavailable. Check model access."
        if code in {400, 422}:
            return (
                "PROVIDER_INCOMPATIBLE",
                "Provider rejected the model/tool request. Check compatibility.",
            )
    return "AGENT_FAILED", "Provider or tool request failed; retry later."
