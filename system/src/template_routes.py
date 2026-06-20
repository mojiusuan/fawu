"""
文书模板 API 路由
v3.0: 修复路径遍历漏洞
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from src.document_service import document_service
from src.auth_service.dependencies import get_current_user, require_role
from pathlib import Path

router = APIRouter(prefix="/api/templates", tags=["文书模板"])


def _safe_filename(filename: str) -> str:
    """防止路径遍历攻击：只保留文件名部分，拒绝包含路径分隔符的名称。"""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "无效的文件名")
    # 只取 basename，丢弃任何路径前缀
    return Path(filename).name


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
async def download_template(template_id: str, current_user: dict = Depends(get_current_user)):
    path = document_service.get_template_download(template_id)
    if not path:
        raise HTTPException(404, "模板文件不存在")
    return FileResponse(path, filename=f"{template_id}.docx",
                        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.get("/{template_id}/download/{filename}")
async def download_assembled(template_id: str, filename: str,
                              current_user: dict = Depends(get_current_user)):
    safe_name = _safe_filename(filename)
    path = document_service._export_dir / safe_name
    # 确保解析后的路径仍在导出目录内
    if not str(path.resolve()).startswith(str(document_service._export_dir.resolve())):
        raise HTTPException(403, "禁止访问该文件")
    if not path.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(path, filename=safe_name,
                        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
