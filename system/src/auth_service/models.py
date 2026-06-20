"""
认证授权 - 数据模型
"""
from pydantic import BaseModel, Field
from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"         # 管理员：全部功能 + 系统配置 + 用户管理
    LEGAL = "legal"         # 法务：合同管理 + 咨询 + 知识图谱 + RPA
    BUSINESS = "business"   # 业务人员：上传合同 + 发起审查 + 咨询
    AUDITOR = "auditor"     # 审计员：仅查看审计报告和日志


class UserInfo(BaseModel):
    id: str
    username: str
    display_name: str
    role: Role
    created_at: str = ""


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str = Field(..., min_length=1, max_length=64)
    role: Role = Role.BUSINESS


class UserUpdateRequest(BaseModel):
    password: str | None = Field(None, min_length=8, max_length=128)
    display_name: str | None = Field(None, min_length=1, max_length=64)
    role: Role | None = None


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo
