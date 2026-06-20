"""
评论服务 —— CRUD。
"""
from datetime import datetime, timezone
from ..utils.file_store import comments_store, generate_id
from .notification_service import _create_notification


def create_comment(
    entity_type: str,
    entity_id: str,
    user_id: str,
    user_name: str,
    content: str,
    parent_id: str | None = None,
) -> dict:
    comment = {
        "comment_id": generate_id(),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user_id,
        "user_name": user_name,
        "content": content,
        "parent_id": parent_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    def add(comments):
        comments.append(comment)
        return comment

    return comments_store.update(add)


def list_comments(entity_type: str, entity_id: str) -> list[dict]:
    comments = comments_store.load()
    result = [c for c in comments if c["entity_type"] == entity_type and c["entity_id"] == entity_id]
    result.sort(key=lambda c: c["created_at"])
    return result


def delete_comment(comment_id: str, user_id: str) -> bool:
    def apply(comments):
        for i, c in enumerate(comments):
            if c["comment_id"] == comment_id:
                if c["user_id"] != user_id:
                    raise PermissionError("只能删除自己的评论")
                comments.pop(i)
                return True
        return False

    return comments_store.update(apply) or False
