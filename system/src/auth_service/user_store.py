"""
用户存储 - JSON 文件持久化
"""
import json
import uuid
from datetime import datetime
from pathlib import Path

from src.config import settings
from src.auth_service.models import UserInfo, Role
from src.auth_service.jwt_handler import hash_password


class UserStore:
    """用户数据存储"""

    def __init__(self):
        self._users: dict[str, dict] = {}       # id -> user dict
        self._by_username: dict[str, str] = {}  # username -> id
        self._store_path = Path(settings.BASE_DIR) / "data" / "users_store.json"
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        self._load()
        self._ensure_default_admin()

    def _save(self):
        data = [u for u in self._users.values()]
        self._store_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load(self):
        if not self._store_path.exists():
            return
        try:
            data = json.loads(self._store_path.read_text(encoding="utf-8"))
            for u in data:
                self._users[u["id"]] = u
                self._by_username[u["username"]] = u["id"]
        except Exception as e:
            print(f"  [WARN] 用户数据加载失败: {e}")

    def _ensure_default_admin(self):
        if self._users:
            return
        self.create_user(
            username="admin",
            hashed_password=hash_password("admin123"),
            display_name="系统管理员",
            role=Role.ADMIN.value,
        )
        print("  [AUTH] 已创建默认管理员账号 admin / admin123")

    def create_user(self, username: str, hashed_password: str, display_name: str, role: str) -> UserInfo:
        uid = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()
        record = {
            "id": uid,
            "username": username,
            "display_name": display_name,
            "hashed_password": hashed_password,
            "role": role,
            "created_at": now,
        }
        self._users[uid] = record
        self._by_username[username] = uid
        self._save()
        return UserInfo(id=uid, username=username, display_name=display_name, role=Role(role), created_at=now)

    def get_by_id(self, user_id: str) -> UserInfo | None:
        u = self._users.get(user_id)
        if not u:
            return None
        return UserInfo(
            id=u["id"], username=u["username"], display_name=u["display_name"],
            role=Role(u["role"]), created_at=u.get("created_at", ""),
        )

    def get_by_username(self, username: str) -> dict | None:
        uid = self._by_username.get(username)
        if not uid:
            return None
        return self._users.get(uid)

    def list_users(self) -> list[UserInfo]:
        return [
            UserInfo(
                id=u["id"], username=u["username"], display_name=u["display_name"],
                role=Role(u["role"]), created_at=u.get("created_at", ""),
            )
            for u in self._users.values()
        ]

    def update_user(self, user_id: str, **kwargs) -> UserInfo | None:
        u = self._users.get(user_id)
        if not u:
            return None
        for k, v in kwargs.items():
            if v is not None:
                u[k] = v
        self._save()
        return UserInfo(
            id=u["id"], username=u["username"], display_name=u["display_name"],
            role=Role(u["role"]), created_at=u.get("created_at", ""),
        )

    def delete_user(self, user_id: str) -> bool:
        u = self._users.pop(user_id, None)
        if not u:
            return False
        self._by_username.pop(u["username"], None)
        self._save()
        return True


user_store = UserStore()
