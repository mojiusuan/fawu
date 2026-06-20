"""
咨询服务 - 业务逻辑层（JSON 文件持久化）
"""
import json
import uuid
from datetime import datetime
from pathlib import Path

from src.config import settings
from src.consultation_service.models import (
    AskResponse, SearchRequest, SearchResponse,
    SearchResult, ConsultationHistory,
)
from src.rag_service.retriever import hybrid_retriever


class ConsultationService:
    """法律咨询服务"""

    def __init__(self):
        self._history: list[ConsultationHistory] = []
        self._store_path = Path(settings.BASE_DIR) / "data" / "consultation_history.json"
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        self._load()

    def _save(self):
        data = [{"id": h.id, "question": h.question, "answer_summary": h.answer_summary,
                 "user_id": getattr(h, 'user_id', ''), "timestamp": h.timestamp} for h in self._history]
        self._store_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load(self):
        if not self._store_path.exists():
            return
        try:
            data = json.loads(self._store_path.read_text(encoding="utf-8"))
            self._history = [ConsultationHistory(**d) for d in data]
        except Exception as e:
            print(f"  [WARN] 咨询历史加载失败: {e}")

    async def search(self, req: SearchRequest) -> SearchResponse:
        results = await hybrid_retriever.search(
            query=req.query,
            source_type=req.source_type.value if hasattr(req.source_type, "value") else req.source_type,
            top_k=req.top_k,
        )
        search_results = [
            SearchResult(
                source=r.get("source", ""), article=r.get("article", ""),
                excerpt=r.get("excerpt", ""), full_content=r.get("full_content", ""),
                date=r.get("date", ""), relevance=r.get("relevance", "中"),
            )
            for r in results
        ]
        st = req.source_type.value if hasattr(req.source_type, "value") else req.source_type
        return SearchResponse(query=req.query, source_type=st, total=len(search_results), results=search_results)

    def add_history(self, question: str, answer_summary: str, user_id: str = "") -> ConsultationHistory:
        h = ConsultationHistory(
            id=str(uuid.uuid4())[:8],
            question=question,
            answer_summary=answer_summary,
            user_id=user_id,
            timestamp=datetime.now().isoformat(),
        )
        self._history.append(h)
        self._save()
        return h

    def get_history(self, user_id: str = "") -> list[ConsultationHistory]:
        if user_id:
            return [h for h in self._history if getattr(h, 'user_id', '') == user_id][-20:]
        return self._history[-20:]


consultation_service = ConsultationService()
