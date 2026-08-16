"""LLM 服务封装（DeepSeek API）"""

import hashlib
import time
from typing import AsyncGenerator, Literal

from openai import AsyncOpenAI

from ..core.config import settings

# Prompt 模板
# 通用澄清指令（需求 3.4：模糊问题引导收束）
CLARIFY_RULE = "如果用户问题模糊或存在多种理解，先简述你的理解再回答；信息不足时礼貌追问 1 个关键细节。"

PROMPT_KB = """你是知识库「{kb_name}」的智能助手。请基于以下参考资料回答用户问题。
如果参考资料不足以回答，请如实告知并建议补充相关文档。

参考资料：
{context}

回答要求：
1. {clarify}
2. 优先基于参考资料，不要编造内容
3. 引用来源时使用格式：[来源: 《文档名》P页码]
4. 回答简洁准确，控制篇幅"""

PROMPT_DOC = """你是文档导师。用户正在阅读《{doc_name}》，当前在第 {page} 页附近。
请基于文档内容回答用户问题，帮助用户理解文档中的概念。

文档相关内容：
{context}

回答要求：
1. {clarify}
2. 优先基于当前文档内容
3. 引用时注明具体页码：[来源: 第X页]
4. 如果文档未覆盖问题，建议用户查看知识库其他文档
5. 回答简洁易懂"""

PROMPT_GLOBAL = """你是学习导航助手。根据用户已有知识库，帮助解答一般性知识问题。
{context}

回答要求：
1. {clarify}
2. 综合你的知识给出准确回答
3. 建议用户可深入了解的知识库方向
4. 回答简洁友好"""


class LLMService:
    """DeepSeek API 封装（兼容 OpenAI SDK）"""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
        self.model = settings.DEEPSEEK_MODEL

    # ==================== 基础对话（向后兼容） ====================

    async def chat_stream(
        self,
        question: str,
        context: str = "",
    ) -> AsyncGenerator[str, None]:
        """简单流式对话，逐 token 产出（保持向后兼容）"""
        system_prompt = (
            "你是一个知识库助手。请根据提供的上下文和你的知识，"
            "准确、简洁地回答用户问题。如果上下文不足，请如实说明。"
        )
        messages = [{"role": "system", "content": system_prompt}]
        if context:
            messages.append({"role": "system", "content": f"参考上下文：{context}"})
        messages.append({"role": "user", "content": question})

        async for chunk in self._stream_api(messages):
            yield chunk

    # ==================== RAG 对话 ====================

    async def chat_stream_rag(
        self,
        question: str,
        sources: list[dict],
        scenario: Literal["kb", "doc", "global"],
        kb_name: str = "",
        doc_name: str = "",
        doc_page: int = 0,
        chat_history: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        """RAG 增强流式对话

        Args:
            question: 用户问题
            sources: RAG 检索结果 [{chunk_text, doc_name, page_num, ...}]
            scenario: kb / doc / global
            kb_name: 知识库名称（kb 场景）
            doc_name: 文档名称（doc 场景）
            doc_page: 当前页码（doc 场景）
            chat_history: 最近对话历史 [{role, content}, ...]
        """
        # 1. 构建参考资料文本
        context_text = self._build_source_text(sources)

        # 2. 选择 Prompt 模板
        if scenario == "kb":
            system_prompt = PROMPT_KB.format(
                kb_name=kb_name,
                context=context_text or "（暂无相关资料，请基于你的知识回答）",
                clarify=CLARIFY_RULE,
            )
        elif scenario == "doc":
            system_prompt = PROMPT_DOC.format(
                doc_name=doc_name,
                page=doc_page or "?",
                context=context_text or "（文档内容加载中...）",
                clarify=CLARIFY_RULE,
            )
        else:  # global
            kb_hint = f"用户有以下知识库：{kb_name}" if kb_name else ""
            system_prompt = PROMPT_GLOBAL.format(context=kb_hint, clarify=CLARIFY_RULE)

        # 3. 组装消息
        messages = [{"role": "system", "content": system_prompt}]

        # 加入最近对话历史（最近 6 轮）
        if chat_history:
            for msg in chat_history[-12:]:  # 最近 6 轮 = 12 条消息
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        # 当前问题
        messages.append({"role": "user", "content": question})

        # 4. 调用 API
        async for chunk in self._stream_api(messages):
            yield chunk

    async def _stream_api(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        """底层 OpenAI 流式调用

        异常向上抛出，由调用方（chat.py）转换为 SSE error 事件。
        """
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=2000,
        )
        async for chunk in response:
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content

    # ==================== 非流式调用（图谱分析用） ====================

    async def chat_complete(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: int = 4000,
        json_mode: bool = False,
    ) -> str:
        """非流式对话，返回完整回复文本

        Args:
            messages: OpenAI 格式消息列表
            temperature: 温度（概念提取用低温度 0.3）
            max_tokens: 最大输出 token
            json_mode: 是否强制 JSON 输出
        """
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""

    async def generate_followups(self, question: str, answer: str) -> list[str]:
        """基于问题与回答生成推荐追问（最多 2 个）"""
        prompt = (
            "基于用户的提问和 AI 的回答，生成最多 2 个用户可能继续追问的问题。\n"
            "要求：\n"
            "1. 问题必须与当前话题相关，能引导深入探索\n"
            "2. 简洁明确，每个不超过 30 字\n"
            "3. 严格返回 JSON 数组格式，如 [\"追问1\", \"追问2\"]\n\n"
            f"用户提问：{question[:200]}\n\n"
            f"AI 回答：{answer[:500]}"
        )
        messages = [
            {"role": "system", "content": "你是对话助手，负责生成推荐追问。请严格按JSON格式输出。"},
            {"role": "user", "content": prompt},
        ]

        try:
            result_text = await self.chat_complete(
                messages, temperature=0.5, max_tokens=200, json_mode=True
            )
            import json as _json
            data = _json.loads(result_text.strip())
            # 兼容 {"questions": [...]} 或直接数组
            if isinstance(data, dict):
                data = data.get("questions", data.get("follow_up_questions", []))
            if isinstance(data, list):
                return [str(q)[:50] for q in data[:2] if str(q).strip()]
        except Exception:
            pass
        return []

    # ==================== 工具 ====================

    @staticmethod
    def _build_source_text(sources: list[dict]) -> str:
        """将 RAG 检索结果拼接为 Prompt 参考资料"""
        if not sources:
            return ""
        lines = []
        for i, s in enumerate(sources, 1):
            lines.append(
                f"[来源{i}: 《{s.get('doc_name', '未知')}》"
                f"第{s.get('page_num', '?')}页] "
                f"{s.get('chunk_text', '')}"
            )
        return "\n\n".join(lines)

    @staticmethod
    def gen_message_id() -> str:
        """生成唯一消息 ID"""
        return "msg_" + hashlib.md5(
            f"{time.time()}{id(object())}".encode()
        ).hexdigest()[:12]


# ==================== 单例 ====================

_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
