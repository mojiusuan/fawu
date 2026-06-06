"""
法规专题库 + 人工转接 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException
from src.topic_service import topic_service
from src.auth_service.dependencies import get_current_user
import json
import uuid
from datetime import datetime
from pathlib import Path
from src.config import settings

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


# === 人工转接 ===

@router_esc.post("/request")
async def create_escalation(payload: dict, current_user: dict = Depends(get_current_user)):
    """提交转人工服务申请"""
    request_id = str(uuid.uuid4())[:8]
    record = {
        "request_id": request_id,
        "user_id": current_user.get("user_id", "anonymous"),
        "user_name": current_user.get("display_name", ""),
        "question": payload.get("question", ""),
        "contact": payload.get("contact", ""),
        "priority": payload.get("priority", "normal"),
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }

    store_path = Path(settings.BASE_DIR) / "data" / "escalation_requests.json"
    existing = []
    if store_path.exists():
        existing = json.loads(store_path.read_text(encoding="utf-8"))
    existing.append(record)
    store_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "request_id": request_id,
        "status": "pending",
        "message": "您的转人工服务申请已提交，专业法务人员将在1个工作日内与您联系。",
    }


@router_esc.get("/status/{request_id}")
async def get_escalation_status(request_id: str, current_user: dict = Depends(get_current_user)):
    store_path = Path(settings.BASE_DIR) / "data" / "escalation_requests.json"
    if not store_path.exists():
        raise HTTPException(404, "申请不存在")
    data = json.loads(store_path.read_text(encoding="utf-8"))
    for r in data:
        if r["request_id"] == request_id:
            return r
    raise HTTPException(404, "申请不存在")
