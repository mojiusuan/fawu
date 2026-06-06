"""
案情分析 - 数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional


class CaseProfileCreate(BaseModel):
    case_name: str = Field(..., description="案件名称")
    case_type: str = Field(..., description="案由: labor/loan/injury/marriage/consumer/property/contract/other")
    description: str = Field(..., description="案情描述")


class CaseProfileUpdate(BaseModel):
    case_name: Optional[str] = None
    status: Optional[str] = None  # assessing/negotiating/litigating/closed


class CaseProfileInfo(BaseModel):
    case_id: str
    user_id: str
    case_name: str
    case_type: str
    case_type_name: str
    status: str
    description: str
    structured_facts: dict = Field(default_factory=dict)
    created_at: str
    updated_at: str


class AnalysisRequest(BaseModel):
    case_type: str = Field(..., description="案由")
    structured_facts: dict = Field(default_factory=dict, description="结构化案情要素")


class AnalysisResponse(BaseModel):
    analysis_id: str
    case_id: str = ""
    summary: str = ""                        # 案情摘要
    legal_basis: list[dict] = Field(default_factory=list)  # [{law, article, content, relevance}]
    similar_cases: list[dict] = Field(default_factory=list) # [{case_number, title, court, date, similarity, key_points, verdict, similarity_reason}]
    risk_assessment: dict = Field(default_factory=dict)    # {level, factors[], suggestions[]}
    evidence_checklist: list[dict] = Field(default_factory=list)  # [{name, description, collected}]
    limitation_check: dict = Field(default_factory=dict)   # {type, period, start_date, end_date, status, days_remaining}
    fee_estimate: dict = Field(default_factory=dict)       # {claim_amount, court_fee, preservation_fee, total}
    disclaimer: str = "本分析报告由 AI 生成，仅供参考，不构成法律意见。具体案件请咨询执业律师。"


class FeeCalcRequest(BaseModel):
    case_type: str = Field(default="property", description="案件类型")
    claim_amount: float = Field(..., description="诉讼标的额（元）")
    include_preservation: bool = Field(default=False, description="是否含保全费")
    include_execution: bool = Field(default=False, description="是否含执行费")
    preservation_amount: float = Field(default=0, description="保全金额")


class FeeCalcResponse(BaseModel):
    claim_amount: float
    court_fee: float
    preservation_fee: float = 0
    execution_fee: float = 0
    total: float
    breakdown: list[dict] = Field(default_factory=list)
    reduction_note: str = ""


class CompensationRequest(BaseModel):
    scenario: str = Field(..., description="场景: labor_unpaid_salary/labor_illegal_dismissal/personal_injury/consumer_fraud")
    params: dict = Field(default_factory=dict, description="计算参数")


class CompensationResponse(BaseModel):
    scenario: str
    scenario_name: str
    items: list[dict] = Field(default_factory=list)
    total_min: float = 0
    total_max: float = 0
    legal_basis: str = ""
    notes: list[str] = Field(default_factory=list)


class LimitationRequest(BaseModel):
    case_type: str = Field(default="general", description="案件类型")
    event_date: str = Field(..., description="权利受侵害日期/知道日期 (YYYY-MM-DD)")


class LimitationResponse(BaseModel):
    limitation_type: str
    limitation_name: str
    period_text: str
    event_date: str
    deadline_date: str
    days_remaining: int
    is_expired: bool
    status_text: str
    legal_basis: str
    special_rules: list[str] = Field(default_factory=list)
    interruption_reasons: list[str] = Field(default_factory=list)
