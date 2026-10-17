"""OCR and LLM Vision Enrichment module for MarkFlow conversion pipeline."""

from __future__ import annotations

import base64
import io
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import httpx
from PIL import Image

KOREAN_OCR_PROMPT = (
    "이미지 속 글자를 빠짐없이 원문 그대로 추출하고, "
    "표는 Markdown 표로, 도식이나 다이어그램은 구조를 글머리표로 상세히 설명하세요."
)


@dataclass
class LLMConfig:
    """Configuration for LLM / Vision OCR."""
    enabled: bool = False
    provider: str = "local"  # "gemini" | "local" | "custom"
    base_url: str = "http://localhost:1234/v1"
    api_key: str = "not-needed"
    model: str = "gemini-2.5-flash"  # or local model id
    prompt: str = KOREAN_OCR_PROMPT
    enable_azure_docintel: bool = False
    azure_endpoint: str = ""
    azure_key: str = ""


class _ChatCompletions:
    def __init__(self, client_wrapper: "OpenAICompatClient"):
        self._client_wrapper = client_wrapper

    def create(self, model: str, messages: list[dict], **kwargs: Any) -> Any:
        return self._client_wrapper._request_completions(model=model, messages=messages, **kwargs)


class _Chat:
    def __init__(self, client_wrapper: "OpenAICompatClient"):
        self.completions = _ChatCompletions(client_wrapper)


class OpenAICompatClient:
    """
    Lightweight OpenAI-compatible client using httpx.
    Supports Gemini Flash OpenAI endpoint, LM Studio, Ollama, and Local LLMs.
    Includes 429 Exponential Backoff retry.
    """

    def __init__(self, base_url: str, api_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key or "not-needed"
        self.chat = _Chat(self)

    def _request_completions(self, model: str, messages: list[dict], **kwargs: Any) -> Any:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.1),
        }

        # Exponential backoff on 429
        max_retries = 3
        backoff = 1.0

        for attempt in range(max_retries):
            try:
                with httpx.Client(timeout=45.0) as http_client:
                    response = http_client.post(url, headers=headers, json=payload)

                    if response.status_code == 429:
                        time.sleep(backoff)
                        backoff *= 2.0
                        continue

                    response.raise_for_status()
                    data = response.json()

                    # Return mock response object matching openai interface
                    content = ""
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        content = choices[0]["message"].get("content", "")

                    return _MockOpenAIResponse(content=content)

            except Exception as e:
                if attempt == max_retries - 1:
                    raise RuntimeError(f"LLM API request failed after {max_retries} attempts: {e}")
                time.sleep(backoff)
                backoff *= 2.0

        raise RuntimeError("LLM API rate limit exceeded (429)")


class _MockMessage:
    def __init__(self, content: str):
        self.content = content


class _MockChoice:
    def __init__(self, content: str):
        self.message = _MockMessage(content)


class _MockOpenAIResponse:
    def __init__(self, content: str):
        self.choices = [_MockChoice(content)]


def get_llm_client(config: LLMConfig) -> Optional[OpenAICompatClient]:
    """Build OpenAI-compatible client based on provider settings."""
    if not config.enabled:
        return None

    if config.provider == "gemini":
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
        return OpenAICompatClient(base_url=base_url, api_key=config.api_key)
    elif config.provider == "local":
        base_url = config.base_url or "http://localhost:1234/v1"
        return OpenAICompatClient(base_url=base_url, api_key="local-llm")
    else:
        return OpenAICompatClient(base_url=config.base_url, api_key=config.api_key)


def enrich_image_file(image_path: Path, config: LLMConfig) -> str:
    """
    Perform direct OCR/Vision extraction on an image using LLM.
    Returns extracted Markdown text.
    """
    client = get_llm_client(config)
    if client is None:
        return ""

    try:
        raw_bytes = image_path.read_bytes()
        b64 = base64.b64encode(raw_bytes).decode("utf-8")
        ext = image_path.suffix.lower().lstrip(".")
        mime = "image/png" if ext == "png" else "image/jpeg"

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": config.prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                ],
            }
        ]

        resp = client.chat.completions.create(model=config.model, messages=messages)
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"> [OCR 추출 실패 또는 건너뜀: {str(e)}]"
