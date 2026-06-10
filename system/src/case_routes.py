"""
案件管理 + 案情分析 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException
from src.case_analysis_service.models import (
    CaseProfileCreate, CaseProfileUpdate, CaseProfileInfo,
    AnalysisRequest, AnalysisResponse,
)
from src.case_service import case_service
from src.case_analysis_service.analyzer import case_analyzer
from src.auth_service.dependencies import get_current_user

router = APIRouter(prefix="/api/case", tags=["案件管理"])


# === 案件档案 ===

@router.post("/profiles")
async def create_case_profile(req: CaseProfileCreate, current_user: dict = Depends(get_current_user)):
    case = case_service.create(
        user_id=current_user.get("user_id", "anonymous"),
        case_name=req.case_name,
        case_type=req.case_type,
        description=req.description,
    )
    return case


@router.get("/profiles")
async def list_case_profiles(status: str = "", current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "admin":
        return case_service.list_all(status)
    return case_service.list_by_user(current_user.get("user_id", "anonymous"), status)


@router.get("/profiles/{case_id}")
async def get_case_profile(case_id: str, current_user: dict = Depends(get_current_user)):
    case = case_service.get(case_id)
    if not case:
        raise HTTPException(404, "案件不存在")
    return case


@router.put("/profiles/{case_id}")
async def update_case_profile(case_id: str, req: CaseProfileUpdate,
                               current_user: dict = Depends(get_current_user)):
    case = case_service.update(case_id, **req.model_dump(exclude_none=True))
    if not case:
        raise HTTPException(404, "案件不存在")
    return case


@router.delete("/profiles/{case_id}")
async def delete_case_profile(case_id: str, current_user: dict = Depends(get_current_user)):
    ok = case_service.delete(case_id)
    if not ok:
        raise HTTPException(404, "案件不存在")
    return {"ok": True}


# === 案情分析 ===

@router.get("/types")
async def get_case_types(current_user: dict = Depends(get_current_user)):
    return case_analyzer.get_case_types()


@router.post("/analyze")
async def analyze_case(req: AnalysisRequest, current_user: dict = Depends(get_current_user)):
    report = await case_analyzer.analyze(
        case_type=req.case_type,
        structured_facts=req.structured_facts,
        user_id=current_user.get("user_id", "anonymous"),
    )
    return report


@router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    result = case_analyzer.get_analysis(analysis_id)
    if not result:
        raise HTTPException(404, "分析记录不存在")
    return result
