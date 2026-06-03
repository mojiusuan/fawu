"""
咨询服务 - 数据模型
"""
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class SourceType(str, Enum):
    LAWS = "法规"
    CASES = "判例"
    CONTRACTS = "合同"
    ALL = "全部"


class AskRequest(BaseModel):
    question: str = Field(..., description="法律问题")
    source_type: SourceType = Field(default=SourceType.ALL, description="检索范围")


class SearchRequest(BaseModel):
    query: str = Field(..., description="搜索关键词")
    source_type: SourceType = Field(default=SourceType.ALL, description="搜索范围")
    top_k: int = Field(default=10, description="返回数量")


class SearchResult(BaseModel):
    source: str = Field(..., description="来源")
    article: str = Field(default="", description="条款编号")
    excerpt: str = Field(default="", description="原文摘录")
    full_content: str = Field(default="", description="完整内容")
    date: str = Field(default="", description="日期")
    relevance: str = Field(default="中", description="相关性")


class AskResponse(BaseModel):
    question: str
    answer: str
    search_results: list[SearchResult] = Field(default_factory=list)
    law_basis: list[str] = Field(default_factory=list)
    disclaimer: str = "本回答为 AI 辅助生成，不构成正式法律意见。具体法律事务请咨询执业律师。"
    audit_id: str = ""


class SearchResponse(BaseModel):
    query: str
    source_type: str
    total: int
    results: list[SearchResult]


class ConsultationHistory(BaseModel):
    id: str
    question: str
    answer_summary: str
    timestamp: str
