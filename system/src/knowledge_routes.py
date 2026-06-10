"""
知识库管理 API —— 管理员初始化/重建知识库
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends
from src.auth_service.dependencies import require_admin
from src.config import settings

router = APIRouter(prefix="/api/knowledge", tags=["知识库管理"])


@router.get("/status")
async def get_knowledge_status(current_user: dict = Depends(require_admin())):
    """获取知识库当前状态（仅管理员）"""
    status = {
        "chromadb": {"available": False, "collection": "", "count": 0},
        "whoosh": {"available": False, "index_dir": ""},
        "knowledge_files": {"count": 0, "dir": str(settings.KNOWLEDGE_BASE_DIR)},
    }

    # ChromaDB 状态
    try:
        from src.rag_service.retriever import hybrid_retriever
        if hybrid_retriever.is_initialized():
            status["chromadb"]["available"] = True
            status["chromadb"]["collection"] = hybrid_retriever._collection.name
            status["chromadb"]["count"] = hybrid_retriever._collection.count()
    except Exception:
        pass

    # Whoosh 状态
    try:
        whoosh_dir = Path(settings.KNOWLEDGE_BASE_DIR) / "whoosh_index"
        status["whoosh"]["available"] = whoosh_dir.exists()
        status["whoosh"]["index_dir"] = str(whoosh_dir)
    except Exception:
        pass

    # 知识源文件数量
    kb_dir = Path(settings.KNOWLEDGE_BASE_DIR)
    if kb_dir.exists():
        status["knowledge_files"]["count"] = sum(
            1 for _ in kb_dir.rglob("*") if _.is_file() and _.suffix in (".txt", ".md", ".json")
        )

    return status


@router.post("/init")
async def init_knowledge_base(current_user: dict = Depends(require_admin())):
    """初始化或重建知识库（仅管理员）"""
    try:
        from src.rag_service.retriever import hybrid_retriever
        from src.rag_service.parser import legal_parser
        from src.rag_service.embedder import embedder

        kb_dir = Path(settings.KNOWLEDGE_BASE_DIR)
        if not kb_dir.exists() or not any(kb_dir.iterdir()):
            return {"status": "error", "message": "knowledge/ 目录为空，请先添加知识源文件"}

        all_chunks = []
        files_processed = 0

        for file_path in kb_dir.rglob("*"):
            if file_path.is_file() and file_path.suffix in (".txt", ".md"):
                try:
                    chunks = legal_parser.parse_to_documents(str(file_path))
                    all_chunks.extend(chunks)
                    files_processed += 1
                except Exception:
                    pass

        if not all_chunks:
            return {"status": "error", "message": "未从知识源文件中解析到有效内容"}

        # 重建向量索引
        hybrid_retriever.index_documents(all_chunks)

        return {
            "status": "ok",
            "message": f"知识库初始化完成",
            "files_processed": files_processed,
            "chunks_indexed": len(all_chunks),
        }

    except Exception as e:
        return {"status": "error", "message": f"知识库初始化失败: {str(e)[:200]}"}
