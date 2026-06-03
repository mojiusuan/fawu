"""
合同服务单元测试
运行: pytest tests/test_contract_service.py -v
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from src.contract_service.models import (
    ContractUploadRequest,
    ContractReviewResult,
    RiskLevel,
    ClauseInfo,
    ContractType,
)
from src.contract_service.service import ContractService


class TestContractService:
    """合同服务测试"""

    def setup_method(self):
        self.service = ContractService()

    def test_create_contract(self):
        """测试创建合同"""
        contract = self.service.create_contract(
            title="测试合同",
            contract_type="买卖合同",
            content="第一条 合同标的\n第二条 价款",
            party_a="甲方公司",
            party_b="乙方公司",
        )
        assert contract.id is not None
        assert contract.title == "测试合同"
        assert contract.contract_type == "买卖合同"
        assert contract.party_a == "甲方公司"

    def test_get_contract(self):
        """测试获取合同"""
        c = self.service.create_contract("测试", "买卖合同", "内容")
        fetched = self.service.get_contract(c.id)
        assert fetched is not None
        assert fetched.id == c.id

    def test_get_contract_not_found(self):
        """测试获取不存在的合同"""
        result = self.service.get_contract("nonexistent")
        assert result is None

    def test_list_contracts(self):
        """测试合同列表"""
        self.service.create_contract("合同1", "买卖合同", "内容")
        self.service.create_contract("合同2", "租赁合同", "内容")
        contracts = self.service.list_contracts()
        assert len(contracts) == 2

    def test_parse_clauses(self):
        """测试条款解析"""
        content = "第一条 合同标的\n1. 买卖标的为电子产品。\n第二条 价款\n1. 总价款50万元。"
        clauses = self.service.parse_clauses(content)
        assert len(clauses) >= 1
        assert all(isinstance(c, ClauseInfo) for c in clauses)

    def test_build_review_result(self):
        """测试审查结果构建"""
        clauses = [
            ClauseInfo(
                clause_number="第一条",
                content="测试",
                risk_level=RiskLevel.HIGH,
                risk_analysis="高风险",
                law_basis="民法典第585条",
                suggestion="修改",
            ),
            ClauseInfo(
                clause_number="第二条",
                content="正常条款",
                risk_level=RiskLevel.LOW,
            ),
        ]
        result = self.service.build_review_result("test_id", clauses, "综合建议", "audit_001")
        assert result.contract_id == "test_id"
        assert result.high_risks == 1
        assert result.medium_risks == 0
        assert result.low_risks == 1


class TestModels:
    """数据模型测试"""

    def test_risk_level_enum(self):
        assert RiskLevel.HIGH.value == "high"
        assert RiskLevel.MEDIUM.value == "medium"
        assert RiskLevel.LOW.value == "low"

    def test_contract_type_enum(self):
        assert ContractType.PURCHASE.value == "买卖合同"
        assert ContractType.LEASE.value == "租赁合同"

    def test_clause_info(self):
        clause = ClauseInfo(
            clause_number="第一条",
            content="测试内容",
            risk_level=RiskLevel.HIGH,
            risk_analysis="分析",
            law_basis="民法典",
            suggestion="建议",
        )
        assert clause.risk_level == RiskLevel.HIGH
        assert clause.law_basis == "民法典"

    def test_contract_upload_request(self):
        req = ContractUploadRequest(
            title="测试",
            contract_type=ContractType.PURCHASE,
            content="第一条",
            party_a="甲方",
            party_b="乙方",
        )
        assert req.title == "测试"
        assert req.party_a == "甲方"
