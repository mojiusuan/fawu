"""
合同服务 - 数据模型
"""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class RiskLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class ContractType(str, Enum):
    PURCHASE = "买卖合同"
    LEASE = "租赁合同"
    SERVICE = "服务合同"
    LABOR = "劳动合同"
    LOAN = "借款合同"
    OTHER = "其他"


# ========== 请求模型 ==========

class ContractUploadRequest(BaseModel):
    title: str = Field(..., description="合同名称")
    contract_type: str = Field(default="其他", description="合同类型")
    content: str = Field(..., description="合同文本内容")
    party_a: str = Field(default="", description="甲方")
    party_b: str = Field(default="", description="乙方")


class ContractReviewRequest(BaseModel):
    contract_id: str = Field(..., description="合同ID")
    review_scope: str = Field(default="全部条款", description="审查范围")


class ContractCompareRequest(BaseModel):
    contract_a_id: str = Field(..., description="合同A（基准）")
    contract_b_id: str = Field(..., description="合同B（待审）")


class ContractGenerateRequest(BaseModel):
    contract_type: ContractType = Field(..., description="合同类型")
    party_a: str = Field(..., description="甲方信息")
    party_b: str = Field(..., description="乙方信息")
    key_terms: str = Field(default="", description="关键条款要求")


# ========== 响应模型 ==========

class ClauseInfo(BaseModel):
    clause_number: str
    content: str
    risk_level: Optional[RiskLevel] = None
    risk_analysis: Optional[str] = None
    law_basis: Optional[str] = None
    suggestion: Optional[str] = None


class ContractInfo(BaseModel):
    id: str
    title: str
    contract_type: str
    party_a: str
    party_b: str
    content: str
    clauses: list[ClauseInfo] = Field(default_factory=list)
    created_at: str
    review_status: str = "未审查"


class ContractReviewResult(BaseModel):
    contract_id: str
    review_summary: str
    high_risks: int = 0
    medium_risks: int = 0
    low_risks: int = 0
    clauses: list[ClauseInfo] = Field(default_factory=list)
    suggestions: str = ""
    audit_id: str = ""


class ContractCompareResult(BaseModel):
    contract_a_title: str
    contract_b_title: str
    total_clauses: int = 0
    identical: int = 0
    formal_diff: int = 0
    substantive_diff: int = 0
    differences: list[dict] = Field(default_factory=list)


class ContractGenerateResult(BaseModel):
    title: str
    content: str
    warnings: list[str] = Field(default_factory=list)
