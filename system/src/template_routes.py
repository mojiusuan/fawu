"""
文书模板 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from src.document_service import document_service
from src.auth_service.dependencies import get_current_user

router = APIRouter(prefix="/api/templates", tags=["文书模板"])


@router.get("")
async def list_templates(current_user: dict = Depends(get_current_user)):
    return document_service.list_templates()


@router.get("/{template_id}")
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    t = document_service.get_template(template_id)
    if not t:
        raise HTTPException(404, "模板不存在")
    return t


@router.post("/{template_id}/assemble")
async def assemble_document(template_id: str, fields: dict,
                            current_user: dict = Depends(get_current_user)):
    result = document_service.assemble(template_id, fields)
    if not result:
        raise HTTPException(404, "模板不存在")
    return result


@router.get("/{template_id}/download")
async def download_template(template_id: str):
    path = document_service.get_template_download(template_id)
    if not path:
        raise HTTPException(404, "模板文件不存在")
    return FileResponse(path, filename=f"{template_id}.docx",
                        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.get("/{template_id}/download/{filename}")
async def download_assembled(template_id: str, filename: str):
    path = document_service._export_dir / filename
    if not path.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(path, filename=filename,
                        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
