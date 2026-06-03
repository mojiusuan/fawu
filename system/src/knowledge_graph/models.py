"""
知识图谱模型 —— Neo4j 节点/关系定义
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


# ========== 节点模型 ==========

class Law(BaseModel):
    """法律法规"""
    name: str = Field(..., description="法规名称")
    law_type: str = Field(default="民事", description="类型: 民事/刑事/商事/行政")
    effective_date: str = Field(default="", description="施行日期")
    status: str = Field(default="现行有效", description="状态")
    issuing_body: str = Field(default="", description="颁布机构")


class Article(BaseModel):
    """法条"""
    article_number: str = Field(..., description="条款编号，如 第584条")
    content: str = Field(..., description="条文内容")
    law_name: str = Field(..., description="所属法规")
    chapter: str = Field(default="", description="所属章节")


class Case(BaseModel):
    """判例"""
    case_number: str = Field(..., description="案号")
    title: str = Field(..., description="案件名称")
    court: str = Field(default="", description="审理法院")
    case_date: str = Field(default="", description="裁判日期")
    case_type: str = Field(default="", description="案件类型")
    parties: list[str] = Field(default_factory=list, description="当事人")
    facts: str = Field(default="", description="案件事实")
    verdict: str = Field(default="", description="判决结果")
    key_points: list[str] = Field(default_factory=list, description="争议焦点")


class Contract(BaseModel):
    """合同"""
    title: str = Field(..., description="合同名称")
    contract_type: str = Field(default="", description="合同类型")
    party_a: str = Field(default="", description="甲方")
    party_b: str = Field(default="", description="乙方")
    sign_date: str = Field(default="", description="签署日期")
    file_path: str = Field(default="", description="文件路径")


class Clause(BaseModel):
    """条款"""
    clause_number: str = Field(..., description="条款编号")
    content: str = Field(..., description="条款内容")
    contract_title: str = Field(default="", description="所属合同")
    risk_level: str = Field(default="", description="风险等级: high/medium/low/none")


class RiskPoint(BaseModel):
    """风险点"""
    risk_type: str = Field(..., description="风险类型")
    level: str = Field(..., description="风险等级: high/medium/low")
    description: str = Field(..., description="风险描述")
    law_basis: str = Field(default="", description="法律依据")
    suggestion: str = Field(default="", description="修改建议")


class LegalConcept(BaseModel):
    """法律概念"""
    name: str = Field(..., description="概念名称")
    definition: str = Field(default="", description="定义")
    related_laws: list[str] = Field(default_factory=list, description="相关法律")


class Court(BaseModel):
    """法院"""
    name: str = Field(..., description="法院名称")
    level: str = Field(default="", description="法院层级")
    jurisdiction: str = Field(default="", description="管辖范围")


# ========== 关系类型常量 ==========

class RelationType:
    CONTAINS = "CONTAINS"           # 包含条款
    HAS_RISK = "HAS_RISK"           # 存在风险
    BASED_ON = "BASED_ON"           # 法律依据
    BELONGS_TO = "BELONGS_TO"       # 属于
    CITES = "CITES"                 # 引用
    APPLIES = "APPLIES"             # 适用
    HEARD_BY = "HEARD_BY"           # 审理
    REFERENCES = "REFERENCES"       # 参考
    RELATED_TO = "RELATED_TO"       # 关联
    DEFINED_IN = "DEFINED_IN"       # 定义于
    SIMILAR_TO = "SIMILAR_TO"       # 相似
    PRECEDENT_FOR = "PRECEDENT_FOR" # 先例


# ========== 查询结果模型 ==========

class EntityDetail(BaseModel):
    entity_type: str
    entity_id: str
    properties: dict


class RelationshipDetail(BaseModel):
    source_type: str
    source_id: str
    relation: str
    target_type: str
    target_id: str


class GraphQueryResult(BaseModel):
    entities: list[EntityDetail] = Field(default_factory=list)
    relationships: list[RelationshipDetail] = Field(default_factory=list)
