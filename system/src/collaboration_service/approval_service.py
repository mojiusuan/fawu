"""
审批服务 —— 提交、审批、驳回。
"""
from datetime import datetime, timezone
from typing import Optional
from ..utils.file_store import approvals_store, generate_id
from .notification_service import _create_notification


def submit_approval(
    entity_type: str,
    entity_id: str,
    submitted_by: str,
    approver_id: str,
    comment: str | None = None,
) -> dict:
    approval = {
        "approval_id": generate_id(),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "submitted_by": submitted_by,
        "approver_id": approver_id,
        "status": "pending",
        "comment": comment,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "decided_at": None,
    }

    def add(approvals):
        approvals.append(approval)
        return approval

    result = approvals_store.update(add)

    _create_notification(
        user_id=approver_id,
        title="新的审批请求",
        body=f"有人向您提交了审批请求",
        notification_type="approval_requested",
        entity_type=entity_type,
        entity_id=entity_id,
        action_url="/tasks",
    )

    return result


def list_approvals(user_id: str, filter_type: str = "my_pending") -> list[dict]:
    approvals = approvals_store.load()

    if filter_type == "my_pending":
        approvals = [a for a in approvals if a["approver_id"] == user_id and a["status"] == "pending"]
    elif filter_type == "submitted_by_me":
        approvals = [a for a in approvals if a["submitted_by"] == user_id]

    approvals.sort(key=lambda a: a["submitted_at"], reverse=True)
    return approvals


def approve(approval_id: str, approver_id: str, comment: str | None = None) -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()

    def apply(approvals):
        for a in approvals:
            if a["approval_id"] == approval_id:
                if a["approver_id"] != approver_id:
                    raise PermissionError("只有指定的审批人才能审批")
                if a["status"] != "pending":
                    raise ValueError("该审批已处理")
                a["status"] = "approved"
                a["decided_at"] = now
                if comment:
                    a["comment"] = (a.get("comment") or "") + "\n审批意见: " + comment
                result = dict(a)
                _create_notification(
                    user_id=a["submitted_by"],
                    title="审批已通过",
                    body="您提交的审批请求已通过",
                    notification_type="approval_result",
                    entity_type=a["entity_type"],
                    entity_id=a["entity_id"],
                )
                return result
        return None

    return approvals_store.update(apply)


def reject(approval_id: str, approver_id: str, comment: str | None = None) -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()

    def apply(approvals):
        for a in approvals:
            if a["approval_id"] == approval_id:
                if a["approver_id"] != approver_id:
                    raise PermissionError("只有指定的审批人才能驳回")
                if a["status"] != "pending":
                    raise ValueError("该审批已处理")
                a["status"] = "rejected"
                a["decided_at"] = now
                if comment:
                    a["comment"] = (a.get("comment") or "") + "\n驳回意见: " + comment
                result = dict(a)
                _create_notification(
                    user_id=a["submitted_by"],
                    title="审批已驳回",
                    body=f"您提交的审批请求已被驳回" + (f"：{comment}" if comment else ""),
                    notification_type="approval_result",
                    entity_type=a["entity_type"],
                    entity_id=a["entity_id"],
                )
                return result
        return None

    return approvals_store.update(apply)
