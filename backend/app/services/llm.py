"""LLM adapter — the single integration point.

Switch provider via LLM_PROVIDER: mock | anthropic | azure | bedrock | ollama.
All callers go through `complete()`, which takes a system + user prompt and returns
the model's raw text. `mock` needs no credentials so the app runs out of the box.

The AI's job in EIGG Prevent is to *draft* and *flag* — it never attests compliance.
"""
import os

from app.core.config import settings

ANTHROPIC_MODEL = "claude-opus-4-8"


def model_name(provider: str | None = None) -> str:
    provider = provider or settings.llm_provider
    return {
        "anthropic": ANTHROPIC_MODEL,
        "azure": settings.azure_openai_deployment,
        "ollama": settings.ollama_model,
        "bedrock": settings.aws_bedrock_model_id,
        "mock": "mock",
    }.get(provider, provider)


def provider_availability() -> list[dict]:
    return [
        {"id": "mock", "label": "Mock (dev)", "model": "mock", "available": True},
        {"id": "anthropic", "label": "Anthropic (Claude)", "model": ANTHROPIC_MODEL,
         "available": bool(settings.anthropic_api_key)},
        {"id": "ollama", "label": "Ollama (self-hosted)", "model": settings.ollama_model,
         "available": bool(settings.ollama_base_url)},
        {"id": "azure", "label": "Azure OpenAI", "model": settings.azure_openai_deployment,
         "available": bool(settings.azure_openai_key and settings.azure_openai_endpoint)},
        {"id": "bedrock", "label": "AWS Bedrock", "model": settings.aws_bedrock_model_id,
         "available": bool(os.getenv("AWS_ACCESS_KEY_ID"))},
    ]


async def complete(system: str, user: str, *, provider: str | None = None,
                   max_tokens: int = 2048, json_mode: bool = False) -> str:
    provider = provider or settings.llm_provider
    if provider == "mock":
        return _mock(system, user, json_mode)
    if provider == "anthropic":
        return await _anthropic(system, user, max_tokens)
    if provider == "azure":
        return await _azure(system, user, json_mode)
    if provider == "ollama":
        return await _ollama(system, user, json_mode)
    if provider == "bedrock":
        return await _bedrock(system, user, max_tokens)
    raise ValueError(f"Unknown LLM provider: {provider}")


# ── Providers ─────────────────────────────────────────────────────────────────

async def _anthropic(system: str, user: str, max_tokens: int) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model=ANTHROPIC_MODEL, max_tokens=max_tokens, system=system,
        messages=[{"role": "user", "content": user}],
    )
    for block in msg.content:
        if block.type == "text":
            return block.text
    raise RuntimeError("No text content in Anthropic response")


async def _azure(system: str, user: str, json_mode: bool) -> str:
    from openai import AsyncAzureOpenAI
    client = AsyncAzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_key,
        api_version="2024-08-01-preview",
    )
    resp = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        response_format={"type": "json_object"} if json_mode else {"type": "text"},
    )
    return resp.choices[0].message.content


async def _ollama(system: str, user: str, json_mode: bool) -> str:
    import httpx
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "messages": [{"role": "system", "content": system},
                             {"role": "user", "content": user}],
                "stream": False,
                **({"format": "json"} if json_mode else {}),
            },
        )
        res.raise_for_status()
        return res.json()["message"]["content"]


async def _bedrock(system: str, user: str, max_tokens: int) -> str:
    import asyncio
    import json
    import boto3
    client = boto3.client("bedrock-runtime", region_name=settings.aws_bedrock_region)
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    })
    loop = asyncio.get_event_loop()
    resp = await loop.run_in_executor(
        None, lambda: client.invoke_model(modelId=settings.aws_bedrock_model_id, body=body)
    )
    return json.loads(resp["body"].read())["content"][0]["text"]


def _mock(system: str, user: str, json_mode: bool) -> str:
    """Deterministic stub so the product runs with no credentials.

    Gap analysis (json_mode) is handled in the service layer's mock path, so the
    generic mock here only needs to cover free-text drafting requests.
    """
    if json_mode:
        return '{"findings": []}'
    return (
        "[MOCK DRAFT] This is a development stub. Set LLM_PROVIDER to anthropic, "
        "azure, bedrock or ollama in backend/.env to generate real content. The "
        "drafted text would describe how the organisation meets this requirement, "
        "grounded in the evidence on record."
    )
