"""
证据指引 API 路由
"""
from fastapi import APIRouter, Depends
from src.evidence_service import evidence_service
from src.auth_service.dependencies import get_current_user

router = APIRouter(prefix="/api/evidence", tags=["证据指引"])


@router.get("/cases")
async def list_evidence_cases(current_user: dict = Depends(get_current_user)):
    """列出所有有证据指引的案由"""
    return evidence_service.list_case_types_with_guides()


@router.get("/guide/{case_type}")
async def get_evidence_guide(case_type: str, current_user: dict = Depends(get_current_user)):
    """获取指定案由的证据指引"""
    guide = evidence_service.get_guide(case_type)
    if not guide:
        from fastapi import HTTPException
        raise HTTPException(404, f"案由 '{case_type}' 的证据指引不存在")
    return guide
