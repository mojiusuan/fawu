"""
任务管理服务 —— CRUD + 状态流转 + 通知触发。
"""
from datetime import datetime, timezone
from typing import Optional

from ..utils.file_store import tasks_store, generate_id, DATA_DIR, FileStore

# 通知数据存储
_notif_store = FileStore(str(DATA_DIR / "notifications.json"))


def _create_notification(
    user_id: str,
    title: str,
    body: str,
    notification_type: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    action_url: str | None = None,
) -> None:
    """内部通知创建，在任务状态变更时触发。"""
    notifs = _notif_store.load()
    notifs.append({
        "notification_id": generate_id(),
        "user_id": user_id,
        "title": title,
        "body": body,
        "notification_type": notification_type,
        "is_read": False,
        "action_url": action_url,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _notif_store.save(notifs)


def create_task(
    title: str,
    task_type: str,
    priority: str,
    created_by: str,
    assigned_to: str,
    assigned_by: str,
    description: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    deadline: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    task = {
        "task_id": generate_id(),
        "title": title,
        "description": description,
        "task_type": task_type,
        "status": "pending",
        "priority": priority,
        "created_by": created_by,
        "assigned_to": assigned_to,
        "assigned_by": assigned_by,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "created_at": now,
        "assigned_at": now,
        "accepted_at": None,
        "completed_at": None,
        "deadline": deadline,
        "result_summary": None,
        "notes": None,
    }

    def add(tasks):
        tasks.append(task)
        return task

    result = tasks_store.update(add)

    # 通知被分配人
    _create_notification(
        user_id=assigned_to,
        title="新任务分配",
        body=f"您收到一个新任务：{title}",
        notification_type="task_assigned",
        entity_type="task",
        entity_id=result["task_id"],
        action_url="/tasks",
    )

    return result


def list_tasks(filter_type: str = "my_tasks", user_id: str = "", status: str | None = None) -> list[dict]:
    tasks = tasks_store.load()

    if filter_type == "my_tasks":
        tasks = [t for t in tasks if t["assigned_to"] == user_id]
    elif filter_type == "created_by_me":
        tasks = [t for t in tasks if t["created_by"] == user_id]
    elif filter_type == "assigned_by_me":
        tasks = [t for t in tasks if t["assigned_by"] == user_id]

    if status:
        tasks = [t for t in tasks if t["status"] == status]

    tasks.sort(key=lambda t: t["created_at"], reverse=True)
    return tasks


def _enrich_task_names(task: dict, user_store) -> dict:
    """填充任务中的用户显示名（side-effect free）。"""
    task = dict(task)
    users = {u["id"]: u for u in user_store._users.values()}
    if task.get("created_by") in users:
        task["created_by_name"] = users[task["created_by"]]["display_name"]
    if task.get("assigned_to") in users:
        task["assigned_to_name"] = users[task["assigned_to"]]["display_name"]
    if task.get("assigned_by") in users:
        task["assigned_by_name"] = users[task["assigned_by"]]["display_name"]
    return task


def get_task(task_id: str, user_store=None) -> Optional[dict]:
    tasks = tasks_store.load()
    for t in tasks:
        if t["task_id"] == task_id:
            if user_store:
                return _enrich_task_names(t, user_store)
            return t
    return None


def accept_task(task_id: str, user_id: str) -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()

    def apply(tasks):
        for t in tasks:
            if t["task_id"] == task_id:
                if t["assigned_to"] != user_id:
                    raise PermissionError("只有被指派人才能接受任务")
                if t["status"] != "pending":
                    raise ValueError("任务状态不允许接受操作")
                t["status"] = "accepted"
                t["accepted_at"] = now
                result = dict(t)
                # 通知创建人
                _create_notification(
                    user_id=t["created_by"],
                    title="任务已被接受",
                    body=f"您的任务「{t['title']}」已被接受",
                    notification_type="task_accepted",
                    entity_type="task",
                    entity_id=task_id,
                    action_url="/tasks",
                )
                return result
        return None

    return tasks_store.update(apply)


def reject_task(task_id: str, user_id: str, reason: str = "") -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()

    def apply(tasks):
        for t in tasks:
            if t["task_id"] == task_id:
                if t["assigned_to"] != user_id:
                    raise PermissionError("只有被指派人才能拒绝任务")
                if t["status"] != "pending":
                    raise ValueError("任务状态不允许拒绝操作")
                t["status"] = "rejected"
                t["completed_at"] = now
                t["notes"] = reason
                result = dict(t)
                _create_notification(
                    user_id=t["created_by"],
                    title="任务已被拒绝",
                    body=f"您的任务「{t['title']}」已被拒绝" + (f"，原因：{reason}" if reason else ""),
                    notification_type="task_rejected",
                    entity_type="task",
                    entity_id=task_id,
                    action_url="/tasks",
                )
                return result
        return None

    return tasks_store.update(apply)


def complete_task(task_id: str, user_id: str, result_summary: str = "") -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()

    def apply(tasks):
        for t in tasks:
            if t["task_id"] == task_id:
                if t["assigned_to"] != user_id:
                    raise PermissionError("只有负责人才能完成任务")
                if t["status"] not in ("accepted", "in_progress"):
                    raise ValueError("任务状态不允许完成操作")
                t["status"] = "completed"
                t["completed_at"] = now
                t["result_summary"] = result_summary
                result = dict(t)
                _create_notification(
                    user_id=t["created_by"],
                    title="任务已完成",
                    body=f"您的任务「{t['title']}」已标记完成",
                    notification_type="task_completed",
                    entity_type="task",
                    entity_id=task_id,
                    action_url="/tasks",
                )
                return result
        return None

    return tasks_store.update(apply)


def update_task(task_id: str, updates: dict) -> Optional[dict]:
    allowed = {"title", "description", "priority", "deadline", "notes", "assigned_to"}
    updates = {k: v for k, v in updates.items() if k in allowed and v is not None}

    def apply(tasks):
        for t in tasks:
            if t["task_id"] == task_id:
                t.update(updates)
                if "assigned_to" in updates:
                    _create_notification(
                        user_id=updates["assigned_to"],
                        title="任务重新分配",
                        body=f"您被分配了任务：{t['title']}",
                        notification_type="task_assigned",
                        entity_type="task",
                        entity_id=task_id,
                        action_url="/tasks",
                    )
                return dict(t)
        return None

    return tasks_store.update(apply)


def cancel_task(task_id: str) -> bool:
    def apply(tasks):
        for i, t in enumerate(tasks):
            if t["task_id"] == task_id:
                tasks.pop(i)
                return True
        return False

    return tasks_store.update(apply) or False
