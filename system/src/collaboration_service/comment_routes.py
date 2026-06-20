from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from ..auth_service.dependencies import get_current_user, require_role
from . import comment_service as svc

router = APIRouter(prefix="/api/comments", tags=["comments"])


class CreateCommentRequest(BaseModel):
    entity_type: str = Field(..., pattern=r"^(case|contract|task|approval)$")
    entity_id: str = Field(..., min_length=1, max_length=64)
    content: str = Field(..., min_length=1, max_length=5000)
    parent_id: Optional[str] = None


@router.post("")
async def create_comment(req: CreateCommentRequest, current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    return svc.create_comment(
        entity_type=req.entity_type,
        entity_id=req.entity_id,
        user_id=current_user["user_id"],
        user_name=current_user.get("display_name", current_user.get("username", "")),
        content=req.content,
        parent_id=req.parent_id,
    )


@router.get("/{entity_type}/{entity_id}")
async def list_comments(entity_type: str, entity_id: str, current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    return svc.list_comments(entity_type, entity_id)


@router.delete("/{comment_id}")
async def delete_comment(comment_id: str, current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    try:
        ok = svc.delete_comment(comment_id, current_user["user_id"])
    except PermissionError as e:
        raise HTTPException(403, str(e))
    if not ok:
        raise HTTPException(404, "评论不存在")
    return {"detail": "ok"}
