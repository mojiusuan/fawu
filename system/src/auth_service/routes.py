"""
认证授权 - API 路由
v3.0: 增加登录速率限制和账户锁定
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from src.auth_service.models import (
    LoginRequest, LoginResponse, UserCreateRequest, UserUpdateRequest, UserInfo,
)
from src.auth_service.user_store import user_store
from src.auth_service.jwt_handler import verify_password, hash_password, create_access_token
from src.auth_service.dependencies import require_admin, get_current_user
import time
from collections import defaultdict

router = APIRouter(prefix="/api/auth", tags=["认证授权"])

# 简易内存速率限制器（原型阶段；生产应改用 Redis）
_login_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_LOGIN_ATTEMPTS = 5      # 每分钟最多尝试次数
_LOGIN_WINDOW = 60            # 时间窗口（秒）
_LOCKOUT_THRESHOLD = 10       # 连续失败锁定阈值
_LOCKOUT_MINUTES = 15         # 锁定时间（分钟）
_failed_attempts: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(ip: str) -> None:
    """检查登录速率限制。"""
    now = time.time()
    attempts = [t for t in _login_attempts[ip] if now - t < _LOGIN_WINDOW]
    _login_attempts[ip] = attempts
    if len(attempts) >= _MAX_LOGIN_ATTEMPTS:
        raise HTTPException(429, f"登录尝试过于频繁，请 {_LOGIN_WINDOW} 秒后再试")


def _check_lockout(username: str) -> None:
    """检查账户是否被锁定。"""
    now = time.time()
    failures = [t for t in _failed_attempts[username] if now - t < _LOCKOUT_MINUTES * 60]
    _failed_attempts[username] = failures
    if len(failures) >= _LOCKOUT_THRESHOLD:
        remaining = int((_LOCKOUT_MINUTES * 60) - (now - failures[0]))
        raise HTTPException(429, f"账户已被临时锁定，请在 {remaining // 60} 分钟后重试")


def _record_failure(username: str) -> None:
    _failed_attempts[username].append(time.time())


def _clear_failures(username: str) -> None:
    _failed_attempts.pop(username, None)


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request):
    """用户登录（v3.0: 速率限制 + 账户锁定）。"""
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)
    _check_lockout(req.username)

    _login_attempts[client_ip].append(time.time())

    user_data = user_store.get_by_username(req.username)
    if not user_data:
        _record_failure(req.username)
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not verify_password(req.password, user_data["hashed_password"]):
        _record_failure(req.username)
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    _clear_failures(req.username)
    token = create_access_token(user_data["id"], user_data["username"], user_data["role"])
    user = UserInfo(
        id=user_data["id"],
        username=user_data["username"],
        display_name=user_data["display_name"],
        role=user_data["role"],
        created_at=user_data.get("created_at", ""),
    )
    return LoginResponse(access_token=token, user=user)


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前登录用户信息"""
    uid = current_user.get("user_id", "")
    if uid == "anonymous":
        raise HTTPException(status_code=401, detail="请先登录")
    user = user_store.get_by_id(uid)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.get("/users", response_model=list[UserInfo])
async def list_users(current_user: dict = Depends(require_admin())):
    """列出所有用户（仅管理员）"""
    return user_store.list_users()


@router.get("/assignable-users", response_model=list[UserInfo])
async def list_assignable_users(current_user: dict = Depends(get_current_user)):
    """列出可指派用户（所有角色可用，按当前用户角色过滤）"""
    all_users = user_store.list_users()
    role = current_user.get("role", "")
    if role == "business":
        # 业务人员只能指派给法务和审计员
        return [u for u in all_users if u.role.value in ("legal", "auditor")]
    # 其他角色可指派给任何人
    return all_users


@router.post("/users", response_model=UserInfo)
async def create_user(req: UserCreateRequest, current_user: dict = Depends(require_admin())):
    """创建用户（仅管理员）"""
    existing = user_store.get_by_username(req.username)
    if existing:
        raise HTTPException(status_code=409, detail="用户名已存在")
    hashed = hash_password(req.password)
    return user_store.create_user(
        username=req.username,
        hashed_password=hashed,
        display_name=req.display_name,
        role=req.role.value,
    )


@router.put("/users/{user_id}", response_model=UserInfo)
async def update_user(user_id: str, req: UserUpdateRequest, current_user: dict = Depends(require_admin())):
    """更新用户信息（仅管理员）"""
    updates = {}
    if req.password:
        updates["hashed_password"] = hash_password(req.password)
    if req.display_name:
        updates["display_name"] = req.display_name
    if req.role:
        updates["role"] = req.role.value
    updated = user_store.update_user(user_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="用户不存在")
    return updated


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_admin())):
    """删除用户（仅管理员，不能删除自己）"""
    if current_user.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    if user_store.delete_user(user_id):
        return {"status": "ok", "message": "用户已删除"}
    raise HTTPException(status_code=404, detail="用户不存在")
