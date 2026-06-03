"""
混合检索引擎 —— BM25（Whoosh） + 语义检索（ChromaDB）
"""
import json
import os
from pathlib import Path

from whoosh import index
from whoosh.fields import Schema, TEXT, ID
from whoosh.qparser import QueryParser
import chromadb
from chromadb.config import Settings as ChromaSettings

from src.config import settings
from src.rag_service.embedder import embedding_service
from src.rag_service.citation import citation_formatter
from src.audit_service.logger import audit_logger


class HybridRetriever:
    """BM25 + 语义混合检索器"""

    def __init__(self):
        self._chroma_client = None
        self._collection = None
        self._whoosh_index = None
        self._whoosh_dir = Path(settings.KNOWLEDGE_BASE_DIR) / "whoosh_index"
        self._initialized = False

    @property
    def chroma_client(self):
        if self._chroma_client is None:
            persist_dir = settings.CHROMA_PERSIST_DIR
            os.makedirs(persist_dir, exist_ok=True)
            self._chroma_client = chromadb.PersistentClient(
                path=persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        return self._chroma_client

    @property
    def collection(self):
        if self._collection is None:
            try:
                self._collection = self.chroma_client.get_collection("legal_knowledge")
            except Exception:
                self._collection = self.chroma_client.create_collection("legal_knowledge")
        return self._collection

    @property
    def whoosh_index(self):
        if self._whoosh_index is None:
            self._whoosh_dir.mkdir(parents=True, exist_ok=True)
            try:
                self._whoosh_index = index.open_dir(str(self._whoosh_dir))
            except index.EmptyIndexError:
                self._whoosh_index = self._create_whoosh_index()
        return self._whoosh_index

    def _create_whoosh_index(self):
        schema = Schema(
            chunk_id=ID(stored=True, unique=True),
            title=TEXT(stored=True),
            content=TEXT(stored=True),
            source=TEXT(stored=True),
        )
        return index.create_in(str(self._whoosh_dir), schema)

    def is_initialized(self) -> bool:
        return self._initialized

    async def index_documents(self, chunks: list[dict]):
        """建立向量索引 + 全文索引"""
        # 向量索引 (ChromaDB)
        vectors = await embedding_service.embed_chunks(chunks)
        ids = []
        documents = []
        metadatas = []
        for i, chunk in enumerate(chunks):
            cid = chunk.get("chunk_id", f"chunk_{i}")
            ids.append(cid)
            title = chunk.get("article", chunk.get("title", ""))
            documents.append(f"{title}\n{chunk.get('content', '')}")
            metadatas.append(
                {
                    "source": chunk.get("source", ""),
                    "article": chunk.get("article", ""),
                    "date": chunk.get("effective_date", chunk.get("date", "")),
                }
            )

        # 删除旧 collection（如果存在）
        try:
            self.chroma_client.delete_collection("legal_knowledge")
        except Exception:
            pass
        self._collection = self.chroma_client.create_collection("legal_knowledge")
        self._collection.add(ids=ids, embeddings=vectors, documents=documents, metadatas=metadatas)

        # BM25 索引 (Whoosh)
        writer = self.whoosh_index.writer()
        for i, chunk in enumerate(chunks):
            cid = chunk.get("chunk_id", f"chunk_{i}")
            title = chunk.get("article", chunk.get("title", ""))
            content = chunk.get("content", "")
            source = chunk.get("source", "")
            writer.update_document(
                chunk_id=cid, title=title, content=content, source=source
            )
        writer.commit()

        self._initialized = True
        return len(chunks)

    async def search(
        self,
        query: str,
        source_type: str = "全部",
        top_k: int = 10,
        hybrid_weight: float = 0.7,
    ) -> list[dict]:
        """
        混合检索

        Args:
            query: 查询文本
            source_type: 法规 / 判例 / 合同 / 全部
            top_k: 返回数量
            hybrid_weight: 语义检索权重 (0-1)，越高越偏向语义
        """
        audit_logger.log_rag_query(query, source_type, 0)

        results = []

        # 1. 语义检索 (ChromaDB)
        if self._initialized:
            try:
                query_vec = await embedding_service.embed_query(query)
                where_filter = None
                if source_type == "法规":
                    where_filter = {"source": {"$in": ["民法典", "合同法", "公司法", "劳动法"]}}
                elif source_type == "判例":
                    where_filter = {"source": {"$contains": "案"}}

                semantic_results = self.collection.query(
                    query_embeddings=[query_vec],
                    n_results=top_k * 2,
                    where=where_filter,
                )
                if semantic_results["ids"] and semantic_results["ids"][0]:
                    for i, cid in enumerate(semantic_results["ids"][0]):
                        results.append(
                            {
                                "chunk_id": cid,
                                "content": semantic_results["documents"][0][i]
                                if semantic_results["documents"]
                                else "",
                                "source": semantic_results["metadatas"][0][i].get("source", "")
                                if semantic_results["metadatas"]
                                else "",
                                "article": semantic_results["metadatas"][0][i].get("article", "")
                                if semantic_results["metadatas"]
                                else "",
                                "date": semantic_results["metadatas"][0][i].get("date", "")
                                if semantic_results["metadatas"]
                                else "",
                                "score": 1 - semantic_results["distances"][0][i]
                                if semantic_results["distances"]
                                else 0,
                                "type": "semantic",
                            }
                        )
            except Exception as e:
                print(f"语义检索异常: {e}")

        # 2. BM25 检索 (Whoosh)
        try:
            with self.whoosh_index.searcher() as searcher:
                parser = QueryParser("content", self.whoosh_index.schema)
                q = parser.parse(query)
                hits = searcher.search(q, limit=top_k * 2)
                for hit in hits:
                    # 检查是否已在结果中
                    cid = hit.get("chunk_id", "")
                    if not cid or not any(r.get("chunk_id") == cid for r in results):
                        results.append(
                            {
                                "chunk_id": cid,
                                "content": hit.get("content", ""),
                                "source": hit.get("source", ""),
                                "article": hit.get("title", ""),
                                "date": "",
                                "score": hit.score,
                                "type": "bm25",
                            }
                        )
        except Exception as e:
            print(f"BM25 检索异常: {e}")

        # 3. 合并排序
        results.sort(key=lambda x: x.get("score", 0), reverse=True)
        formatted = [citation_formatter.format_search_result(r) for r in results[:top_k]]

        # 更新审计日志
        audit_logger.log_rag_query(query, source_type, len(formatted))

        return formatted

    async def search_laws(self, query: str, top_k: int = 5) -> list[dict]:
        """快捷法规检索"""
        return await self.search(query, source_type="法规", top_k=top_k)

    async def search_cases(self, query: str, top_k: int = 5) -> list[dict]:
        """快捷判例检索"""
        return await self.search(query, source_type="判例", top_k=top_k)


# 全局单例
hybrid_retriever = HybridRetriever()
