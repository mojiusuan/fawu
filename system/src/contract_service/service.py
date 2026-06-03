"""
合同服务 - 业务逻辑层（JSON 文件持久化）
"""
import json
import uuid
from datetime import datetime
from pathlib import Path

from src.config import settings
from src.contract_service.models import (
    ContractInfo, ClauseInfo, ContractReviewResult,
    ContractCompareResult, ContractGenerateResult, RiskLevel,
)
from src.rag_service.parser import legal_parser


class ContractService:
    """合同管理服务"""

    def __init__(self):
        self._contracts: dict[str, ContractInfo] = {}
        self._store_path = Path(settings.BASE_DIR) / "data" / "contracts_store.json"
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        self._load()

    def _save(self):
        """持久化到 JSON 文件"""
        data = {}
        for cid, c in self._contracts.items():
            data[cid] = {
                "id": c.id,
                "title": c.title,
                "contract_type": c.contract_type,
                "party_a": c.party_a,
                "party_b": c.party_b,
                "content": c.content,
                "created_at": c.created_at,
                "review_status": c.review_status,
                "clauses": [
                    {
                        "clause_number": cl.clause_number,
                        "content": cl.content,
                        "risk_level": cl.risk_level.value if cl.risk_level else None,
                        "risk_analysis": cl.risk_analysis,
                        "law_basis": cl.law_basis,
                        "suggestion": cl.suggestion,
                    }
                    for cl in (c.clauses or [])
                ],
            }
        self._store_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load(self):
        """从 JSON 文件恢复"""
        if not self._store_path.exists():
            return
        try:
            data = json.loads(self._store_path.read_text(encoding="utf-8"))
            for cid, cdata in data.items():
                clauses = []
                for cl_data in cdata.get("clauses", []):
                    cl = ClauseInfo(
                        clause_number=cl_data.get("clause_number", ""),
                        content=cl_data.get("content", ""),
                        risk_level=RiskLevel(cl_data["risk_level"]) if cl_data.get("risk_level") else None,
                        risk_analysis=cl_data.get("risk_analysis"),
                        law_basis=cl_data.get("law_basis"),
                        suggestion=cl_data.get("suggestion"),
                    )
                    clauses.append(cl)
                contract = ContractInfo(
                    id=cdata["id"],
                    title=cdata["title"],
                    contract_type=cdata.get("contract_type", ""),
                    party_a=cdata.get("party_a", ""),
                    party_b=cdata.get("party_b", ""),
                    content=cdata.get("content", ""),
                    created_at=cdata.get("created_at", ""),
                    review_status=cdata.get("review_status", "未审查"),
                    clauses=clauses,
                )
                self._contracts[cid] = contract
        except Exception as e:
            print(f"  [WARN] 合同数据加载失败: {e}")

    def create_contract(self, title: str, contract_type: str, content: str, party_a: str = "", party_b: str = "") -> ContractInfo:
        cid = str(uuid.uuid4())[:8]
        contract = ContractInfo(
            id=cid, title=title, contract_type=contract_type,
            party_a=party_a, party_b=party_b,
            content=content, created_at=datetime.now().isoformat(),
        )
        self._contracts[cid] = contract
        self._save()
        return contract

    def get_contract(self, contract_id: str) -> ContractInfo | None:
        return self._contracts.get(contract_id)

    def list_contracts(self) -> list[ContractInfo]:
        return list(self._contracts.values())

    def update_contract(self, contract: ContractInfo):
        self._contracts[contract.id] = contract
        self._save()

    def parse_clauses(self, content: str) -> list[ClauseInfo]:
        tmp_path = self._store_path.parent / "_tmp_contract.txt"
        tmp_path.write_text(content, encoding="utf-8")
        try:
            chunks = legal_parser.parse_to_documents(str(tmp_path))
        finally:
            if tmp_path.exists():
                tmp_path.unlink()
        return [
            ClauseInfo(
                clause_number=c.get("title", f"第{i+1}条"),
                content=c.get("content", ""),
            )
            for i, c in enumerate(chunks)
        ]

    def build_review_result(self, contract_id: str, clauses: list[ClauseInfo], suggestions: str, audit_id: str) -> ContractReviewResult:
        high = sum(1 for c in clauses if c.risk_level == RiskLevel.HIGH)
        medium = sum(1 for c in clauses if c.risk_level == RiskLevel.MEDIUM)
        low = sum(1 for c in clauses if c.risk_level == RiskLevel.LOW)
        return ContractReviewResult(
            contract_id=contract_id,
            review_summary=f"共审查 {len(clauses)} 条条款，其中高风险 {high} 条，中风险 {medium} 条，低风险 {low} 条",
            high_risks=high, medium_risks=medium, low_risks=low,
            clauses=clauses, suggestions=suggestions, audit_id=audit_id,
        )

    def build_compare_result(self, title_a: str, title_b: str, diffs: list[dict]) -> ContractCompareResult:
        identical = sum(1 for d in diffs if d.get("type") == "identical")
        formal = sum(1 for d in diffs if d.get("type") == "formal")
        substantive = sum(1 for d in diffs if d.get("type") == "substantive")
        return ContractCompareResult(
            contract_a_title=title_a, contract_b_title=title_b,
            total_clauses=len(diffs), identical=identical,
            formal_diff=formal, substantive_diff=substantive, differences=diffs,
        )


contract_service = ContractService()
