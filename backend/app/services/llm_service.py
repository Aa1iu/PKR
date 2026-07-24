"""LLM 服务封装（DeepSeek API）"""

from typing import AsyncGenerator

from openai import AsyncOpenAI

from ..core.config import settings


class LLMService:
    """DeepSeek API 封装（兼容 OpenAI SDK）"""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
        self.model = settings.DEEPSEEK_MODEL

    async def chat_stream(
        self,
        question: str,
        context: str = "",
    ) -> AsyncGenerator[str, None]:
        """流式对话，逐 token 产出"""
        system_prompt = (
            "你是一个知识库助手。请根据提供的上下文和你的知识，"
            "准确、简洁地回答用户问题。如果上下文不足，请如实说明。"
        )
        messages = [
            {"role": "system", "content": system_prompt},
        ]
        if context:
            messages.append({"role": "system", "content": f"参考上下文：{context}"})
        messages.append({"role": "user", "content": question})

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=2000,
            )
            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content
        except Exception as e:
            yield f"[LLM 调用失败: {e}]"


# 单例
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
