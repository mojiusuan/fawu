"""
案件档案中心 —— 案件全生命周期管理
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from src.config import settings


class CaseService:

    def __init__(self):
        self._store_path = Path(settings.BASE_DIR) / "data" / "case_profiles.json"
        self._store_path.parent.mkdir(parents=True, exist_ok=True)

    def _load(self) -> list:
        if not self._store_path.exists():
            return []
        try:
            return json.loads(self._store_path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save(self, data: list):
        self._store_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_case_types(self) -> dict:
        path = Path(settings.BASE_DIR) / "data" / "case_types.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    def create(self, user_id: str, case_name: str, case_type: str,
               description: str = "") -> dict:
        case_types = self._load_case_types()
        ct_info = case_types.get("case_types", {}).get(case_type, {})
        case = {
            "case_id": str(uuid.uuid4())[:8],
            "user_id": user_id,
            "case_name": case_name,
            "case_type": case_type,
            "case_type_name": ct_info.get("name", case_type),
            "status": "assessing",
            "description": description,
            "structured_facts": {},
            "analysis_ids": [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        data = self._load()
        data.append(case)
        self._save(data)
        return case

    def list_by_user(self, user_id: str, status: str = "") -> list[dict]:
        data = self._load()
        cases = [c for c in data if c.get("user_id") == user_id]
        if status:
            cases = [c for c in cases if c.get("status") == status]
        cases.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return cases

    def get(self, case_id: str) -> dict | None:
        data = self._load()
        for c in data:
            if c.get("case_id") == case_id:
                return c
        return None

    def update(self, case_id: str, **kwargs) -> dict | None:
        data = self._load()
        for c in data:
            if c.get("case_id") == case_id:
                allowed = ["case_name", "status", "description", "structured_facts"]
                for k, v in kwargs.items():
                    if k in allowed and v is not None:
                        c[k] = v
                c["updated_at"] = datetime.now().isoformat()
                self._save(data)
                return c
        return None

    def delete(self, case_id: str) -> bool:
        data = self._load()
        new_data = [c for c in data if c.get("case_id") != case_id]
        if len(new_data) < len(data):
            self._save(new_data)
            return True
        return False

    def link_analysis(self, case_id: str, analysis_id: str):
        data = self._load()
        for c in data:
            if c.get("case_id") == case_id:
                ids = c.get("analysis_ids", [])
                if analysis_id not in ids:
                    ids.append(analysis_id)
                    c["analysis_ids"] = ids
                    c["updated_at"] = datetime.now().isoformat()
                    self._save(data)
                return


case_service = CaseService()
