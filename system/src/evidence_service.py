"""
证据指引服务
"""
import json
from pathlib import Path
from src.config import settings


class EvidenceService:

    def __init__(self):
        self._data_dir = Path(settings.BASE_DIR) / "data"

    def _load_guides(self) -> dict:
        path = self._data_dir / "evidence_guides.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    def get_guide(self, case_type: str) -> dict | None:
        """获取指定案由的证据指引"""
        guides = self._load_guides()
        guide = guides.get(case_type)
        if not guide:
            return None

        case_types = self._load_case_types()
        ct_info = case_types.get("case_types", {}).get(case_type, {})
        return {
            "case_type": case_type,
            "case_type_name": ct_info.get("name", case_type),
            "required_evidence": guide.get("required", []),
            "optional_evidence": guide.get("optional", []),
            "preservation_tips": guide.get("preservation_tips", []),
        }

    def _load_case_types(self) -> dict:
        path = self._data_dir / "case_types.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    def list_case_types_with_guides(self) -> list[dict]:
        """列出所有有证据指引的案由"""
        guides = self._load_guides()
        case_types = self._load_case_types()
        result = []
        for key in guides:
            ct_info = case_types.get("case_types", {}).get(key, {})
            result.append({
                "case_type": key,
                "name": ct_info.get("name", key),
                "description": ct_info.get("description", ""),
            })
        return result


evidence_service = EvidenceService()
