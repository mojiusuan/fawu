"""
认证授权 - API 路由
"""
from fastapi import APIRouter, Depends, HTTPException
from src.auth_service.models import (
    LoginRequest, LoginResponse, UserCreateRequest, UserUpdateRequest, UserInfo,
)
from src.auth_service.user_store import user_store
from src.auth_service.jwt_handler import verify_password, hash_password, create_access_token
from src.auth_service.dependencies import require_admin, get_current_user

router = APIRouter(prefix="/api/auth", tags=["认证授权"])


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """用户登录"""
    user_data = user_store.get_by_username(req.username)
    if not user_data:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not verify_password(req.password, user_data["hashed_password"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

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
