"""
咨询服务 - FastAPI 路由
"""
from fastapi import APIRouter, Depends

from src.consultation_service.models import (
    AskRequest, AskResponse, SearchRequest, SearchResponse, ConsultationHistory,
)
from src.consultation_service.service import consultation_service
from src.consultation_service.agent import consultation_agent
from src.auth_service.dependencies import get_current_user

router = APIRouter(prefix="/api/consultation", tags=["法律咨询"])


@router.post("/ask", response_model=AskResponse)
async def ask_question(req: AskRequest, current_user: dict = Depends(get_current_user)):
    """法律问题咨询"""
    st = req.source_type.value if hasattr(req.source_type, "value") else req.source_type
    answer, results, law_basis, audit_id = await consultation_agent.ask(req.question, st,
        user_id=current_user.get("user_id", "anonymous"))

    # 添加到历史
    summary = answer[:100] + "..." if len(answer) > 100 else answer
    consultation_service.add_history(req.question, summary, user_id=current_user.get("user_id", ""))

    return AskResponse(
        question=req.question,
        answer=answer,
        search_results=results,
        law_basis=law_basis,
        audit_id=audit_id,
    )


@router.post("/search", response_model=SearchResponse)
async def search_knowledge(req: SearchRequest, current_user: dict = Depends(get_current_user)):
    """法律知识语义搜索"""
    return await consultation_service.search(req)


@router.get("/history", response_model=list[ConsultationHistory])
async def get_history(current_user: dict = Depends(get_current_user)):
    """获取当前用户的咨询历史"""
    return consultation_service.get_history(user_id=current_user.get("user_id", ""))
