"""
文档向量化 —— 使用 OpenAI Embedding
"""
from src.utils.llm_client import llm_client


class EmbeddingService:
    """向量化服务"""

    def __init__(self):
        self.client = llm_client
        self._chunks: list[dict] = []  # 内存缓存
        self._vectors: list[list[float]] = []

    async def embed_chunks(self, chunks: list[dict]) -> list[list[float]]:
        """将文档块向量化"""
        texts = []
        for c in chunks:
            # 组合标题和内容用于生成向量
            title = c.get("article", c.get("title", ""))
            content = c.get("content", "")
            texts.append(f"{title}\n{content}")

        vectors = await self.client.embed_texts(texts)
        self._chunks = chunks
        self._vectors = vectors
        return vectors

    async def embed_query(self, query: str) -> list[float]:
        """将查询向量化"""
        return await self.client.embed_query(query)

    def get_chunks(self) -> list[dict]:
        return self._chunks

    def get_vectors(self) -> list[list[float]]:
        return self._vectors


embedding_service = EmbeddingService()
