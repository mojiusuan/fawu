"""
合同服务 - FastAPI 路由
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from src.contract_service.models import (
    ContractUploadRequest,
    ContractReviewRequest,
    ContractCompareRequest,
    ContractGenerateRequest,
    ContractInfo,
    ContractReviewResult,
    ContractCompareResult,
    ContractGenerateResult,
)
from src.contract_service.service import contract_service
from src.contract_service.agent import contract_agent

router = APIRouter(prefix="/api/contracts", tags=["合同管理"])


@router.post("/upload", response_model=ContractInfo)
async def upload_contract(req: ContractUploadRequest):
    """上传/创建合同"""
    contract = contract_service.create_contract(
        title=req.title,
        contract_type=req.contract_type.value if hasattr(req.contract_type, "value") else req.contract_type,
        content=req.content,
        party_a=req.party_a,
        party_b=req.party_b,
    )
    # 解析条款
    clauses = contract_service.parse_clauses(req.content)
    contract.clauses = clauses
    return contract


@router.get("/{contract_id}", response_model=ContractInfo)
async def get_contract(contract_id: str):
    """获取合同详情"""
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return contract


@router.get("/", response_model=list[ContractInfo])
async def list_contracts():
    """获取合同列表"""
    return contract_service.list_contracts()


@router.post("/review/{contract_id}", response_model=ContractReviewResult)
async def review_contract(contract_id: str):
    """审查合同"""
    contract = contract_service.get_contract(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")

    # 如果有未解析的条款，先解析
    if not contract.clauses:
        contract.clauses = contract_service.parse_clauses(contract.content)

    # Agent 审查
    reviewed_clauses, suggestions = await contract_agent.review_contract(
        contract_id=contract_id,
        title=contract.title,
        contract_type=contract.contract_type,
        clauses=contract.clauses,
    )

    # 更新合同并持久化
    contract.clauses = reviewed_clauses
    contract.review_status = "已审查"
    contract_service.update_contract(contract)
    return contract_service.build_review_result(contract_id, reviewed_clauses, suggestions, "")


@router.post("/compare", response_model=ContractCompareResult)
async def compare_contracts(req: ContractCompareRequest):
    """比对两份合同"""
    contract_a = contract_service.get_contract(req.contract_a_id)
    contract_b = contract_service.get_contract(req.contract_b_id)

    if not contract_a or not contract_b:
        raise HTTPException(status_code=404, detail="合同不存在")

    if not contract_a.clauses:
        contract_a.clauses = contract_service.parse_clauses(contract_a.content)
    if not contract_b.clauses:
        contract_b.clauses = contract_service.parse_clauses(contract_b.content)

    diffs = await contract_agent.compare_contracts(
        contract_a.title, contract_a.clauses, contract_b.title, contract_b.clauses
    )

    return contract_service.build_compare_result(contract_a.title, contract_b.title, diffs)


@router.post("/generate", response_model=ContractGenerateResult)
async def generate_contract(req: ContractGenerateRequest):
    """AI 生成合同草案"""
    content = await contract_agent.generate_contract(
        contract_type=req.contract_type.value if hasattr(req.contract_type, "value") else req.contract_type,
        party_a=req.party_a,
        party_b=req.party_b,
        key_terms=req.key_terms,
    )

    ct_value = req.contract_type.value if hasattr(req.contract_type, "value") else req.contract_type
    title = f"{ct_value} - {req.party_a} vs {req.party_b}"

    # 自动保存到合同库
    contract_service.create_contract(
        title=title,
        contract_type=ct_value,
        content=content,
        party_a=req.party_a,
        party_b=req.party_b,
    )

    return ContractGenerateResult(
        title=title,
        content=content,
        warnings=["本文件为 AI 辅助生成草稿，需经执业律师审核确认后方可使用。"],
    )


@router.delete("/clear")
async def clear_contracts():
    """清除所有合同"""
    contract_service._contracts.clear()
    contract_service._save()
    return {"status": "ok", "message": "所有合同已清除"}
