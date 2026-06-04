"""
智能法务系统 - FastAPI 主入口
"""
# 必须在所有 import 之前设置 HF_ENDPOINT，否则 huggingface 下载走不通
import os
from src.config import settings
os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/api/audit/logs")
async def get_audit_logs(current_user: dict = Depends(require_role("admin","auditor"))):
    """获取审计日志列表"""
    from src.audit_service.logger import audit_logger
    logs = audit_logger.get_all_logs(limit=100)
    return {"total": len(logs), "logs": logs}


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
