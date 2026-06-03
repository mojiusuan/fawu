"""
合规审计日志 —— 记录每次 AI 调用的完整决策链路
"""
import json
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path

from src.config import settings


class AuditLogger:
    """审计日志记录器"""

    def __init__(self):
        self.audit_file = Path(settings.AUDIT_LOG_DIR) / "audit.jsonl"
        self.rag_file = Path(settings.AUDIT_LOG_DIR) / "rag_queries.jsonl"
        self.prompt_file = Path(settings.AUDIT_LOG_DIR) / "prompt_usage.jsonl"
        self._ensure_files()

    def _ensure_files(self):
        settings.ensure_directories()
        for f in [self.audit_file, self.rag_file, self.prompt_file]:
            if not f.exists():
                f.touch()

    @staticmethod
    def _hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

    def log(
        self,
        user_id: str,
        case_id: str,
        task_type: str,
        prompt_version: str,
        model: str,
        model_params: dict,
        input_text: str,
        rag_queries: list[str],
        rag_results: list[dict],
        output_text: str,
        latency_ms: int,
        token_usage: dict,
    ) -> str:
        """记录一次 AI 调用"""
        audit_id = str(uuid.uuid4())[:8]
        record = {
            "audit_id": audit_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "case_id": case_id,
            "task_type": task_type,
            "prompt_version": prompt_version,
            "model": model,
            "model_params": model_params,
            "input_text_hash": self._hash(input_text),
            "rag_queries": rag_queries,
            "rag_results": rag_results,
            "output_text_hash": self._hash(output_text),
            "latency_ms": latency_ms,
            "token_usage": token_usage,
        }
        with open(self.audit_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        return audit_id

    def log_rag_query(self, query: str, source_type: str, result_count: int):
        """记录 RAG 检索"""
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "query": query,
            "source_type": source_type,
            "result_count": result_count,
        }
        with open(self.rag_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    def log_prompt_usage(
        self, task: str, template_version: str, input_hash: str, model: str, temperature: float
    ):
        """记录 Prompt 使用"""
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "task": task,
            "template_version": template_version,
            "input_hash": input_hash,
            "model": model,
            "temperature": temperature,
        }
        with open(self.prompt_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    def query(self, condition: str | None = None, limit: int = 50) -> list[dict]:
        """查询审计记录"""
        if not self.audit_file.exists():
            return []
        results = []
        with open(self.audit_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                record = json.loads(line)
                if condition:
                    # 简单文本匹配
                    if condition.lower() not in json.dumps(record, ensure_ascii=False).lower():
                        continue
                results.append(record)
        return results[-limit:]

    def get_stats(self, start: str | None = None, end: str | None = None) -> dict:
        """获取统计信息"""
        records = self.query()
        tasks = {}
        models = {}
        sessions = set()
        users = set()
        for r in records:
            t = r.get("task_type", "unknown")
            tasks[t] = tasks.get(t, 0) + 1
            m = r.get("model", "unknown")
            models[m] = models.get(m, 0) + 1
            sessions.add(r.get("case_id"))
            users.add(r.get("user_id"))
        return {
            "total": len(records),
            "tasks": tasks,
            "models": models,
            "cases": len(sessions),
            "users": len(users),
        }


    def get_all_logs(self, limit: int = 100) -> list[dict]:
        """获取所有审计日志"""
        return self.query(limit=limit)


# 全局单例
audit_logger = AuditLogger()
