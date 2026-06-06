"""
计算器 API 路由 —— 诉讼费 / 赔偿金 / 时效
"""
from fastapi import APIRouter
from src.case_analysis_service.models import (
    FeeCalcRequest, FeeCalcResponse,
    CompensationRequest, CompensationResponse,
    LimitationRequest, LimitationResponse,
)
from src.calculator_service import calculator_service

router = APIRouter(prefix="/api/calculator", tags=["计算工具"])


@router.post("/court-fee")
async def calc_court_fee(req: FeeCalcRequest):
    """诉讼费用估算"""
    result = calculator_service.calc_court_fee(
        case_type=req.case_type,
        claim_amount=req.claim_amount,
        include_preservation=req.include_preservation,
        include_execution=req.include_execution,
        preservation_amount=req.preservation_amount,
    )
    return result


@router.post("/compensation")
async def calc_compensation(req: CompensationRequest):
    """赔偿/补偿金额估算"""
    result = calculator_service.calc_compensation(
        scenario=req.scenario,
        params=req.params,
    )
    return result


@router.post("/limitation")
async def check_limitation(req: LimitationRequest):
    """诉讼时效检查"""
    result = calculator_service.check_limitation(
        case_type=req.case_type,
        event_date=req.event_date,
    )
    return result
