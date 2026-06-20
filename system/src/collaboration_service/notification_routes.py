from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from ..auth_service.dependencies import get_current_user, require_role
from . import notification_service as svc

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(require_role("admin", "legal", "business", "auditor")),
):
    return svc.list_notifications(
        user_id=current_user["user_id"],
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )


@router.get("/unread-count")
async def unread_count(current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    count = svc.get_unread_count(current_user["user_id"])
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    try:
        ok = svc.mark_as_read(notification_id, current_user["user_id"])
    except PermissionError as e:
        raise HTTPException(403, str(e))
    if not ok:
        raise HTTPException(404, "通知不存在")
    return {"detail": "ok"}


@router.put("/read-all")
async def mark_all_read(current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    count = svc.mark_all_read(current_user["user_id"])
    return {"detail": f"已标记 {count} 条通知为已读", "count": count}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    try:
        ok = svc.delete_notification(notification_id, current_user["user_id"])
    except PermissionError as e:
        raise HTTPException(403, str(e))
    if not ok:
        raise HTTPException(404, "通知不存在")
    return {"detail": "ok"}
