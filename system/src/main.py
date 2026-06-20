"""
智能法务系统 - FastAPI 主入口
"""
# 必须在所有 import 之前设置 HF_ENDPOINT，否则 huggingface 下载走不通
import os
import logging
from src.config import settings
os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)

logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import Depends
from pathlib import Path
from src.auth_service.dependencies import require_role


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_directories()
    print(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"  LLM: {settings.LLM_PROVIDER} / {settings.llm_model}")
    print(f"  前端界面: http://{settings.HOST}:{settings.PORT}")
    print(f"  API 文档: http://{settings.HOST}:{settings.PORT}/docs")

    # 检查 Neo4j 连接
    try:
        from neo4j import GraphDatabase
        drv = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD))
        drv.verify_connectivity()
        drv.close()
        print(f"  Neo4j: {settings.NEO4J_URI} - 已连接")
    except Exception as e:
        print(f"  Neo4j: 未连接（知识图谱功能不可用）")

    # 预加载本地嵌入模型（首次需下载，之后秒加载）
    if settings.EMBEDDING_PROVIDER == "local":
        try:
            from src.utils.llm_client import llm_client
            print("  预加载本地嵌入模型...")
            _ = await llm_client.embed_query("init")
        except Exception as e:
            print(f"  模型预加载失败: {e}")

    yield
    print("  服务关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="基于大语言模型的智能法务系统",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---- 静态文件（前端界面） ----
web_dir = Path(__file__).parent.parent / "web"
web_dir.mkdir(parents=True, exist_ok=True)
app.mount("/css", StaticFiles(directory=str(web_dir / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(web_dir / "js")), name="js")


# ---- API 路由 ----
from src.contract_service.routes import router as contract_router
app.include_router(contract_router)

from src.consultation_service.routes import router as consultation_router
app.include_router(consultation_router)

from src.settings_routes import router as settings_router
app.include_router(settings_router)

from src.rpa_routes import router as rpa_router
app.include_router(rpa_router)

from src.export_routes import router as export_router
app.include_router(export_router)

from src.auth_service.routes import router as auth_router
app.include_router(auth_router)

from src.case_routes import router as case_router
app.include_router(case_router)

from src.calculator_routes import router as calculator_router
app.include_router(calculator_router)

from src.evidence_routes import router as evidence_router
app.include_router(evidence_router)

from src.template_routes import router as template_router
app.include_router(template_router)

from src.knowledge_routes import router as knowledge_router
app.include_router(knowledge_router)

from src.topic_routes import router_topics, router_esc
app.include_router(router_topics)
app.include_router(router_esc)

# 协作服务路由
from src.collaboration_service.task_routes import router as task_router
app.include_router(task_router)

from src.collaboration_service.notification_routes import router as notification_router
app.include_router(notification_router)

from src.collaboration_service.comment_routes import router as comment_router
app.include_router(comment_router)

from src.collaboration_service.approval_routes import router as approval_router
app.include_router(approval_router)

@app.get("/api/audit/logs")
async def get_audit_logs(
    task_type: str = "",
    search: str = "",
    limit: int = 100,
    current_user: dict = Depends(require_role("admin","auditor")),
):
    """获取审计日志列表，支持按任务类型和关键词筛选"""
    from src.audit_service.logger import audit_logger
    logs = audit_logger.get_all_logs(limit=limit)
    if task_type:
        logs = [l for l in logs if l.get("task_type") == task_type]
    if search:
        q = search.lower()
        logs = [l for l in logs if q in l.get("task_type", "").lower()
                or q in l.get("case_id", "").lower()
                or q in l.get("model", "").lower()
                or q in l.get("user_id", "").lower()]
    return {"total": len(logs), "logs": logs}


@app.post("/api/audit/export")
async def export_audit_report(
    format: str = "md",
    current_user: dict = Depends(require_role("admin", "auditor")),
):
    """导出审计报告（仅管理员和审计员）"""
    from src.audit_service.reporter import audit_reporter
    try:
        path = audit_reporter.export(format)
        return {"status": "ok", "path": str(path), "format": format}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/kg/search")
async def search_knowledge_graph(
    keyword: str = "",
    current_user: dict = Depends(require_role("admin", "legal")),
):
    """关键词搜索知识图谱实体（Neo4j 全文检索）"""
    from src.knowledge_graph.query import kg_query
    if not keyword.strip():
        return {"results": [], "available": kg_query.is_available}
    try:
        results = kg_query.search_fulltext(keyword.strip())
        return {"results": results, "available": True}
    except Exception as e:
        logger.warning(f"KG 搜索失败: {e}")
        return {"results": [], "available": False}


@app.get("/api/kg/stats")
async def get_kg_stats(current_user: dict = Depends(require_role("admin", "legal"))):
    """获取知识图谱统计信息"""
    from src.knowledge_graph.builder import graph_builder
    try:
        stats = graph_builder.get_stats()
        return {"stats": stats, "available": True}
    except Exception:
        return {"stats": {"nodes": {}, "relationships": 0, "total_nodes": 0}, "available": False}


# ---- 首页 ----
@app.get("/")
async def root():
    return FileResponse(str(web_dir / "index.html"))


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "model": settings.llm_model}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
