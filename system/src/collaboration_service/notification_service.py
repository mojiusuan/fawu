"""
通知服务 —— 查询、标记已读、删除。
（通知创建由各业务服务内部调用 _create_notification）
"""
from datetime import datetime, timezone
from ..utils.file_store import notifications_store, generate_id


def _create_notification(
    user_id: str,
    title: str,
    body: str,
    notification_type: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    action_url: str | None = None,
) -> dict:
    """供外部模块调用的通知创建函数。"""
    notifs = notifications_store.load()
    notif = {
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
    }
    notifs.append(notif)
    notifications_store.save(notifs)
    return notif


def list_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    notifs = notifications_store.load()
    notifs = [n for n in notifs if n["user_id"] == user_id]
    if unread_only:
        notifs = [n for n in notifs if not n["is_read"]]
    notifs.sort(key=lambda n: n["created_at"], reverse=True)
    return notifs[offset:offset + limit]


def get_unread_count(user_id: str) -> int:
    notifs = notifications_store.load()
    return sum(1 for n in notifs if n["user_id"] == user_id and not n["is_read"])


def mark_as_read(notification_id: str, user_id: str) -> bool:
    def apply(notifs):
        for n in notifs:
            if n["notification_id"] == notification_id:
                if n["user_id"] != user_id:
                    raise PermissionError("只能操作自己的通知")
                n["is_read"] = True
                return True
        return False

    return notifications_store.update(apply) or False


def mark_all_read(user_id: str) -> int:
    count = 0

    def apply(notifs):
        nonlocal count
        for n in notifs:
            if n["user_id"] == user_id and not n["is_read"]:
                n["is_read"] = True
                count += 1
        return count

    notifications_store.update(apply)
    return count


def delete_notification(notification_id: str, user_id: str) -> bool:
    def apply(notifs):
        for i, n in enumerate(notifs):
            if n["notification_id"] == notification_id:
                if n["user_id"] != user_id:
                    raise PermissionError("只能删除自己的通知")
                notifs.pop(i)
                return True
        return False

    return notifications_store.update(apply) or False
