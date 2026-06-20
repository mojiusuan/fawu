"""
原子写入 + 文件锁的 JSON 存储基类。
替代现有各 service 中裸读写的 _load/_save 模式。
"""
import json
import os
import threading
import tempfile
from pathlib import Path
from typing import Any, Optional


class FileStore:
    """线程安全的 JSON 文件存储，使用原子写入和锁保护。"""

    def __init__(self, file_path: str, default: Any = None):
        self._path = Path(file_path)
        self._lock = threading.Lock()
        self._default = default if default is not None else []

    def _ensure_dir(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> Any:
        """读取全部数据。文件不存在时返回默认值。"""
        with self._lock:
            if not self._path.exists():
                return self._default
            try:
                with open(self._path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                return self._default

    def save(self, data: Any) -> None:
        """原子写入：先写临时文件，再 rename。"""
        self._ensure_dir()
        with self._lock:
            tmp = tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self._path.parent,
                delete=False,
            )
            try:
                json.dump(data, tmp, ensure_ascii=False, indent=2)
                tmp.flush()
                os.fsync(tmp.fileno())
                tmp.close()
                os.replace(tmp.name, self._path)
            except Exception:
                tmp.close()
                Path(tmp.name).unlink(missing_ok=True)
                raise

    def update(self, mutate_fn) -> Any:
        """原子读-改-写：加载数据，应用变更函数，保存，返回结果。"""
        with self._lock:
            data = self._load_unlocked()
            result = mutate_fn(data)
            self._save_unlocked(data)
            return result

    def _load_unlocked(self) -> Any:
        """不加锁的读取（需在 with self._lock 内调用）。"""
        if not self._path.exists():
            return self._default
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return self._default

    def _save_unlocked(self, data: Any) -> None:
        """不加锁的写入（需在 with self._lock 内调用）。"""
        self._ensure_dir()
        tmp = tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=self._path.parent,
            delete=False,
        )
        try:
            json.dump(data, tmp, ensure_ascii=False, indent=2)
            tmp.flush()
            os.fsync(tmp.fileno())
            tmp.close()
            os.replace(tmp.name, self._path)
        except Exception:
            tmp.close()
            Path(tmp.name).unlink(missing_ok=True)
            raise


def generate_id() -> str:
    """生成完整 36 字符 UUID（修复旧版 8 字符截断的碰撞风险）。"""
    import uuid
    return str(uuid.uuid4())


# 全局存储实例（在需要的地方 import）
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

tasks_store = FileStore(str(DATA_DIR / "tasks.json"))
notifications_store = FileStore(str(DATA_DIR / "notifications.json"))
comments_store = FileStore(str(DATA_DIR / "comments.json"))
approvals_store = FileStore(str(DATA_DIR / "approvals.json"))
escalation_store = FileStore(str(DATA_DIR / "escalation_requests.json"))
