"""
LLM API 统一封装 —— 支持 Claude / GPT-4o / DeepSeek 切换
"""
import os
import time

from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage, SystemMessage

from src.config import settings

DEEPSEEK_BASE_URL = "https://api.deepseek.com"


class LLMClient:
    """统一 LLM 客户端"""

    def __init__(self, provider: str | None = None):
        self.provider = provider or settings.LLM_PROVIDER
        self._chat = None
        self._embeddings = None

    def _build_chat(self, model: str, temperature: float, max_tokens: int):
        """根据 provider 创建 Chat 实例"""
        if self.provider == "claude":
            return ChatAnthropic(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=settings.ANTHROPIC_API_KEY,
            )
        elif self.provider == "deepseek":
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=settings.DEEPSEEK_API_KEY,
                base_url=DEEPSEEK_BASE_URL,
            )
        else:  # openai (默认)
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=settings.OPENAI_API_KEY,
            )

    def _get_model_name(self) -> str:
        if self.provider == "claude":
            return settings.CLAUDE_MODEL
        elif self.provider == "deepseek":
            return settings.DEEPSEEK_MODEL
        return settings.OPENAI_MODEL

    @property
    def chat(self):
        """懒加载 Chat 模型"""
        if self._chat is None:
            self._chat = self._build_chat(
                model=self._get_model_name(),
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
            )
        return self._chat

    @property
    def embeddings(self):
        """懒加载 Embedding 模型"""
        if self._embeddings is None:
            if settings.EMBEDDING_PROVIDER == "local":
                self._embeddings = LocalEmbedding(settings.EMBEDDING_MODEL)
            else:
                self._embeddings = OpenAIEmbeddings(
                    model=settings.EMBEDDING_MODEL,
                    api_key=settings.OPENAI_API_KEY,
                )
        return self._embeddings

    @property
    def embeddings_source(self) -> str:
        if settings.EMBEDDING_PROVIDER == "local":
            return f"本地模型 (BAAI/{settings.EMBEDDING_MODEL})"
        return "OpenAI"

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[str, dict]:
        """调用 LLM 生成回复  Returns: (response_text, usage_info)"""
        # deepseek-reasoner 不支持 system prompt 和 temperature，合并为一条消息
        is_reasoner = self.provider == "deepseek" and "reasoner" in self._get_model_name()
        if is_reasoner:
            combined = f"{system_prompt}\n\n---\n\n{user_prompt}" if system_prompt else user_prompt
            messages = [HumanMessage(content=combined)]
        else:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

        start = time.time()

        if is_reasoner:
            # reasoner 模型不需要 temperature/max_tokens
            chat = self._build_chat(
                model=self._get_model_name(),
                temperature=0,   # ignored by reasoner
                max_tokens=4096, # ignored by reasoner
            )
        elif temperature is not None or max_tokens is not None:
            chat = self._build_chat(
                model=self._get_model_name(),
                temperature=temperature or settings.LLM_TEMPERATURE,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
            )
        else:
            chat = self.chat

        response = await chat.ainvoke(messages)
        latency_ms = int((time.time() - start) * 1000)

        usage = {}
        if hasattr(response, "usage_metadata"):
            u = response.usage_metadata
            usage = {"input": u.get("input_tokens", 0), "output": u.get("output_tokens", 0)}
        elif hasattr(response, "response_metadata"):
            u = response.response_metadata
            usage = {"input": u.get("input_tokens", 0), "output": u.get("output_tokens", 0)}

        usage["latency_ms"] = latency_ms
        return response.content, usage

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return await self.embeddings.aembed_documents(texts)

    async def embed_query(self, query: str) -> list[float]:
        return await self.embeddings.aembed_query(query)


class LocalEmbedding:
    """本地中文嵌入模型（免 API Key，免网络）"""

    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer

        full_name = f"BAAI/{model_name}"
        print(f"  正在加载本地嵌入模型: {full_name}")
        print(f"  镜像: {os.environ.get('HF_ENDPOINT', 'huggingface.co')}")
        print(f"  (首次需下载约 1.3GB，之后秒加载)")

        self._model = SentenceTransformer(full_name)
        print(f"  ✅ 模型就绪 · 维度: {self._model.get_sentence_embedding_dimension()}")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vecs = self._model.encode(texts, normalize_embeddings=True)
        return vecs.tolist()

    def embed_query(self, text: str) -> list[float]:
        vec = self._model.encode(text, normalize_embeddings=True)
        return vec.tolist()

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return self.embed_documents(texts)

    async def aembed_query(self, text: str) -> list[float]:
        return self.embed_query(text)


# 全局单例
llm_client = LLMClient()

