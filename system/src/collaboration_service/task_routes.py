from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from ..auth_service.dependencies import get_current_user, require_role
from ..auth_service.user_store import user_store
from . import task_service as svc

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    task_type: str = Field(..., pattern=r"^(case_review|contract_review|consultation_response|document_draft|escalation_handle|general)$")
    priority: str = Field("normal", pattern=r"^(low|normal|urgent|critical)$")
    assigned_to: str = Field(..., min_length=1, max_length=64)
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    deadline: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    priority: Optional[str] = Field(None, pattern=r"^(low|normal|urgent|critical)$")
    assigned_to: Optional[str] = Field(None, min_length=1, max_length=64)
    deadline: Optional[str] = None
    notes: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=1000)


class CompleteRequest(BaseModel):
    result_summary: Optional[str] = Field(None, max_length=2000)


@router.post("")
async def create_task(req: CreateTaskRequest, current_user=Depends(require_role("admin", "legal", "business"))):
    """创建任务并指派给指定用户。business 只能指派给 legal/auditor。"""
    # 权限检查：business 不能指派给 admin
    if current_user["role"] == "business":
        users = list(user_store._users.values())
        target = next((u for u in users if u["id"] == req.assigned_to), None)
        if not target or target["role"] in ("admin", "business"):
            raise HTTPException(403, "业务人员只能将任务指派给法务人员或审计员")

    try:
        task = svc.create_task(
            title=req.title,
            task_type=req.task_type,
            priority=req.priority,
            created_by=current_user["user_id"],
            assigned_to=req.assigned_to,
            assigned_by=current_user["user_id"],
            description=req.description,
            entity_type=req.entity_type,
            entity_id=req.entity_id,
            deadline=req.deadline,
        )
        return svc._enrich_task_names(task, user_store)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("")
async def list_tasks(
    filter: str = Query("my_tasks", pattern=r"^(my_tasks|created_by_me|assigned_by_me)$"),
    status: Optional[str] = Query(None, pattern=r"^(pending|accepted|in_progress|completed|rejected|cancelled)$"),
    current_user=Depends(require_role("admin", "legal", "business", "auditor")),
):
    tasks = svc.list_tasks(filter_type=filter, user_id=current_user["user_id"], status=status)
    return [svc._enrich_task_names(t, user_store) for t in tasks]


@router.get("/{task_id}")
async def get_task(task_id: str, current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    task = svc.get_task(task_id, user_store)
    if not task:
        raise HTTPException(404, "任务不存在")
    return task


@router.put("/{task_id}/accept")
async def accept_task(task_id: str, current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    try:
        task = svc.accept_task(task_id, current_user["user_id"])
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not task:
        raise HTTPException(404, "任务不存在")
    return svc._enrich_task_names(task, user_store)


@router.put("/{task_id}/reject")
async def reject_task(task_id: str, req: RejectRequest = RejectRequest(), current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    try:
        task = svc.reject_task(task_id, current_user["user_id"], req.reason or "")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not task:
        raise HTTPException(404, "任务不存在")
    return svc._enrich_task_names(task, user_store)


@router.put("/{task_id}/complete")
async def complete_task(task_id: str, req: CompleteRequest = CompleteRequest(), current_user=Depends(require_role("admin", "legal", "business", "auditor"))):
    try:
        task = svc.complete_task(task_id, current_user["user_id"], req.result_summary or "")
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not task:
        raise HTTPException(404, "任务不存在")
    return svc._enrich_task_names(task, user_store)


@router.put("/{task_id}")
async def update_task(task_id: str, req: UpdateTaskRequest, current_user=Depends(require_role("admin", "legal"))):
    task = svc.update_task(task_id, req.model_dump(exclude_none=True))
    if not task:
        raise HTTPException(404, "任务不存在")
    return svc._enrich_task_names(task, user_store)


@router.delete("/{task_id}")
async def cancel_task(task_id: str, current_user=Depends(require_role("admin", "legal"))):
    ok = svc.cancel_task(task_id)
    if not ok:
        raise HTTPException(404, "任务不存在")
    return {"detail": "任务已取消"}
