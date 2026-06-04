"""
FastAPI 认证依赖注入
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from src.auth_service.jwt_handler import decode_access_token
from src.auth_service.models import Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    """
    从 JWT 获取当前用户信息。
    无 token 时返回匿名用户，token 无效时抛出 401。
    """
    if not token:
        return {"user_id": "anonymous", "username": "anonymous", "role": ""}

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")

    return {
        "user_id": payload.get("sub", "unknown"),
        "username": payload.get("username", "unknown"),
        "role": payload.get("role", ""),
    }


def require_role(*allowed_roles: str):
    """
    角色门禁工厂函数。
    用法: current_user: dict = Depends(require_role("admin", "legal"))
    """
    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        role = current_user.get("role", "")
        if not role:
            raise HTTPException(status_code=401, detail="请先登录")
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="权限不足：您的角色无法执行此操作")
        return current_user

    return role_checker


def require_auth():
    """需要任意已认证用户"""
    return require_role(Role.ADMIN.value, Role.LEGAL.value, Role.BUSINESS.value, Role.AUDITOR.value)


def require_admin():
    """需要管理员角色"""
    return require_role(Role.ADMIN.value)
