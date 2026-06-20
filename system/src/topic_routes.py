"""
法规专题库 + 人工转接 API 路由
v3.0: 转接系统修复 —— 不再是死胡同，增加了 list/claim/resolve/close 完整工单流程
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

from src.topic_service import topic_service
from src.auth_service.dependencies import get_current_user, require_role
from src.utils.file_store import escalation_store, generate_id
from src.collaboration_service.notification_service import _create_notification

router_topics = APIRouter(prefix="/api/topics", tags=["法规专题"])
router_esc = APIRouter(prefix="/api/escalation", tags=["人工转接"])


# === 法规专题库 ===

@router_topics.get("")
async def list_topics(current_user: dict = Depends(get_current_user)):
    return topic_service.list_topics()


@router_topics.get("/{topic_id}")
async def get_topic(topic_id: str, current_user: dict = Depends(get_current_user)):
    t = topic_service.get_topic(topic_id)
    if not t:
        raise HTTPException(404, "专题不存在")
    return t


@router_topics.get("/search/{keyword}")
async def search_topics(keyword: str, current_user: dict = Depends(get_current_user)):
    return topic_service.search(keyword)


# === 人工转接（v3.0 完整工单系统） ===

class EscalationRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    contact: str = Field("", max_length=200)
    priority: str = Field("normal", pattern=r"^(low|normal|urgent)$")


class ResolveRequest(BaseModel):
    resolution_note: Optional[str] = Field(None, max_length=2000)


@router_esc.post("/request")
async def create_escalation(req: EscalationRequest, current_user: dict = Depends(get_current_user)):
    """提交转人工服务申请（所有角色）。"""
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "request_id": generate_id(),
        "user_id": current_user.get("user_id", "anonymous"),
        "user_name": current_user.get("username", ""),
        "question": req.question,
        "contact": req.contact,
        "priority": req.priority,
        "status": "pending",
        "assigned_to": None,
        "assigned_at": None,
        "resolved_at": None,
        "resolution_note": None,
        "created_at": now,
    }

    def add(items):
        items.append(record)
        return record

    result = escalation_store.update(add)

    # 通知所有法务人员有新转接
    from src.auth_service.user_store import user_store
    legal_users = [u for u in user_store._users.values() if u["role"] in ("legal", "admin")]
    for u in legal_users:
        _create_notification(
            user_id=u["id"],
            title="新的转人工请求",
            body=f"用户 {current_user.get('username', '')} 提交了转人工申请：{req.question[:100]}",
            notification_type="escalation_updated",
            entity_type="escalation",
            entity_id=result["request_id"],
            action_url="/tasks",
        )

    return {
        "request_id": result["request_id"],
        "status": "pending",
        "message": "您的转人工服务申请已提交，专业法务人员将在1个工作日内与您联系。",
    }


@router_esc.get("/status/{request_id}")
async def get_escalation_status(request_id: str, current_user: dict = Depends(get_current_user)):
    """查询转接申请状态。"""
    items = escalation_store.load()
    for r in items:
        if r["request_id"] == request_id:
            return r
    raise HTTPException(404, "申请不存在")


@router_esc.get("/list")
async def list_escalations(
    current_user: dict = Depends(require_role("admin", "legal")),
):
    """获取所有转接请求列表（法务/管理员可见）。"""
    items = escalation_store.load()
    items.sort(key=lambda x: x["created_at"], reverse=True)
    # 填充受理人名称
    from src.auth_service.user_store import user_store
    users = {u["id"]: u for u in user_store._users.values()}
    for item in items:
        if item.get("assigned_to") in users:
            item["assigned_to_name"] = users[item["assigned_to"]]["display_name"]
    return items


@router_esc.put("/{request_id}/claim")
async def claim_escalation(request_id: str, current_user: dict = Depends(require_role("admin", "legal"))):
    """认领转接请求（法务/管理员）。"""
    now = datetime.now(timezone.utc).isoformat()

    def apply(items):
        for item in items:
            if item["request_id"] == request_id:
                if item["status"] not in ("pending",):
                    raise ValueError("该申请已被处理")
                item["status"] = "processing"
                item["assigned_to"] = current_user["user_id"]
                item["assigned_at"] = now
                result = dict(item)
                _create_notification(
                    user_id=item["user_id"],
                    title="转接申请已被受理",
                    body=f"您的转人工申请已被 {current_user.get('username', '')} 受理",
                    notification_type="escalation_updated",
                    entity_type="escalation",
                    entity_id=request_id,
                )
                return result
        return None

    try:
        result = escalation_store.update(apply)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not result:
        raise HTTPException(404, "申请不存在")
    return result


@router_esc.put("/{request_id}/resolve")
async def resolve_escalation(
    request_id: str,
    req: ResolveRequest = ResolveRequest(),
    current_user: dict = Depends(require_role("admin", "legal")),
):
    """解决转接请求。"""
    now = datetime.now(timezone.utc).isoformat()

    def apply(items):
        for item in items:
            if item["request_id"] == request_id:
                if item["status"] != "processing":
                    raise ValueError("只能解决处理中的申请")
                if item["assigned_to"] != current_user["user_id"]:
                    raise PermissionError("只有受理人才能解决")
                item["status"] = "resolved"
                item["resolved_at"] = now
                item["resolution_note"] = req.resolution_note
                result = dict(item)
                _create_notification(
                    user_id=item["user_id"],
                    title="转接申请已处理",
                    body=f"您的转人工申请已处理完成" + (f"：{req.resolution_note[:200]}" if req.resolution_note else ""),
                    notification_type="escalation_updated",
                    entity_type="escalation",
                    entity_id=request_id,
                )
                return result
        return None

    try:
        result = escalation_store.update(apply)
    except (ValueError, PermissionError) as e:
        raise HTTPException(400 if isinstance(e, ValueError) else 403, str(e))

    if not result:
        raise HTTPException(404, "申请不存在")
    return result


@router_esc.put("/{request_id}/close")
async def close_escalation(request_id: str, current_user: dict = Depends(require_role("admin", "legal"))):
    """关闭转接请求。"""
    def apply(items):
        for item in items:
            if item["request_id"] == request_id:
                item["status"] = "closed"
                return dict(item)
        return None

    result = escalation_store.update(apply)
    if not result:
        raise HTTPException(404, "申请不存在")
    return result
