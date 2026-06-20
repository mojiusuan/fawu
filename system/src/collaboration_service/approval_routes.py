from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from ..auth_service.dependencies import get_current_user, require_role
from ..auth_service.user_store import user_store
from . import approval_service as svc

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


class SubmitApprovalRequest(BaseModel):
    entity_type: str = Field(..., pattern=r"^(contract|case|document)$")
    entity_id: str = Field(..., min_length=1, max_length=64)
    approver_id: str = Field(..., min_length=1, max_length=64)
    comment: Optional[str] = Field(None, max_length=1000)


class DecideRequest(BaseModel):
    comment: Optional[str] = Field(None, max_length=1000)


def _enrich_approval(approval: dict) -> dict:
    """填充审批中的用户显示名。"""
    approval = dict(approval)
    users = {u["id"]: u for u in user_store._users.values()}
    if approval.get("submitted_by") in users:
        approval["submitted_by_name"] = users[approval["submitted_by"]]["display_name"]
    if approval.get("approver_id") in users:
        approval["approver_name"] = users[approval["approver_id"]]["display_name"]
    return approval


@router.post("")
async def submit_approval(req: SubmitApprovalRequest, current_user=Depends(require_role("admin", "legal", "business"))):
    try:
        approval = svc.submit_approval(
            entity_type=req.entity_type,
            entity_id=req.entity_id,
            submitted_by=current_user["user_id"],
            approver_id=req.approver_id,
            comment=req.comment,
        )
        return _enrich_approval(approval)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("")
async def list_approvals(
    filter: str = Query("my_pending", pattern=r"^(my_pending|submitted_by_me)$"),
    current_user=Depends(require_role("admin", "legal", "business", "auditor")),
):
    approvals = svc.list_approvals(user_id=current_user["user_id"], filter_type=filter)
    return [_enrich_approval(a) for a in approvals]


@router.put("/{approval_id}/approve")
async def approve(approval_id: str, req: DecideRequest = DecideRequest(), current_user=Depends(require_role("admin", "legal"))):
    try:
        result = svc.approve(approval_id, current_user["user_id"], req.comment)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not result:
        raise HTTPException(404, "审批记录不存在")
    return _enrich_approval(result)


@router.put("/{approval_id}/reject")
async def reject(approval_id: str, req: DecideRequest = DecideRequest(), current_user=Depends(require_role("admin", "legal"))):
    try:
        result = svc.reject(approval_id, current_user["user_id"], req.comment)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not result:
        raise HTTPException(404, "审批记录不存在")
    return _enrich_approval(result)
