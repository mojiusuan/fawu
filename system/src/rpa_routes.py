"""
RPA 自动化路由
"""
import tempfile
import os
from pathlib import Path

from fastapi import APIRouter, UploadFile, File

from src.agent_service.rpa_agent import rpa_agent

router = APIRouter(prefix="/api/rpa", tags=["RPA 自动化"])


@router.post("/extract")
async def extract_contract_data(file: UploadFile = File(...)):
    """从合同文档中提取结构化数据（支持 PDF/DOCX/TXT）"""
    # 保存上传的文件
    suffix = Path(file.filename).suffix or ".txt"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        content = await file.read()
        tmp.write(content)
        tmp.close()

        result = await rpa_agent.extract_contract_data(tmp.name)
        return result
    except Exception as e:
        return {"error": str(e)}
    finally:
        os.unlink(tmp.name)


@router.post("/batch-extract")
async def batch_extract_clauses(file: UploadFile = File(...)):
    """批量上传合同文件，提取关键条款"""
    suffix = Path(file.filename).suffix or ".txt"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        content = await file.read()
        tmp.write(content)
        tmp.close()

        result = await rpa_agent.batch_extract_key_clauses([tmp.name])
        return result[0] if result else {"文件": file.filename, "状态": "失败"}
    except Exception as e:
        return {"文件": file.filename, "状态": f"失败: {str(e)[:60]}"}
    finally:
        os.unlink(tmp.name)

