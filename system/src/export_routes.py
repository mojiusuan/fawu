"""
导出功能 —— Word 文档下载
"""
import io
from urllib.parse import quote
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/export", tags=["文件导出"])


class ExportChatRequest(BaseModel):
    messages: list[dict]


class ExportTextRequest(BaseModel):
    content: str
    title: str = "合同草案"


def _build_docx(title: str, content_blocks: list[tuple[str, str]]) -> io.BytesIO:
    """生成 Word 文档"""
    from docx import Document
    from docx.shared import Pt, Inches, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()

    # 标题
    h = doc.add_heading(title, level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph("生成时间：" + __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"))
    doc.add_paragraph("生成系统：智能法务系统 v1.0")
    doc.add_paragraph("免责声明：本文档为 AI 辅助生成，不构成正式法律意见。")
    doc.add_paragraph("_" * 60)

    for heading, body in content_blocks:
        if heading:
            doc.add_heading(heading, level=2)
        # 处理 markdown 粗体
        import re
        body_clean = re.sub(r"\*\*(.+?)\*\*", r"\1", body)
        body_clean = re.sub(r"#+\s*", "", body_clean)
        body_clean = re.sub(r"[-*]\s", "· ", body_clean)

        for para_text in body_clean.split("\n"):
            para_text = para_text.strip()
            if para_text:
                p = doc.add_paragraph(para_text)
                p.style.font.size = Pt(11)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


@router.get("/contract-review/{contract_id}")
async def export_contract_review(contract_id: str):
    """导出合同审查报告为 Word"""
    from src.contract_service.service import contract_service

    contract = contract_service.get_contract(contract_id)
    if not contract:
        return {"error": "合同不存在"}
    if not contract.clauses or all(not cl.risk_level or cl.risk_level.value == "none" for cl in contract.clauses):
        return {"error": "该合同尚未审查或未发现风险，请先进行审查"}

    blocks: list[tuple[str, str]] = [(
        "合同信息",
        f"名称：{contract.title}\n"
        f"类型：{contract.contract_type}\n"
        f"甲方：{contract.party_a}\n乙方：{contract.party_b}",
    )]

    high = sum(1 for cl in (contract.clauses or []) if cl.risk_level and cl.risk_level.value == "high")
    medium = sum(1 for cl in (contract.clauses or []) if cl.risk_level and cl.risk_level.value == "medium")
    low = sum(1 for cl in (contract.clauses or []) if cl.risk_level and cl.risk_level.value == "low")
    blocks.append(("审查摘要", f"共审查 {len(contract.clauses or [])} 条，高风险 {high}，中风险 {medium}，低风险 {low}"))

    for cl in (contract.clauses or []):
        if not cl.risk_level or cl.risk_level.value == "none":
            continue
        parts = []
        if cl.content: parts.append(f"原文：{cl.content[:500]}")
        if cl.risk_analysis: parts.append(f"风险分析：{cl.risk_analysis}")
        if cl.law_basis: parts.append(f"法律依据：{cl.law_basis}")
        if cl.suggestion: parts.append(f"修改建议：{cl.suggestion}")
        blocks.append((f"{cl.clause_number}（{cl.risk_level.value}）", "\n".join(parts)))

    buf = _build_docx(f"合同审查报告 —— {contract.title}", blocks)
    filename = f"审查报告_{contract.title}_{contract_id}.docx"
    safe_name = quote(filename)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}"},
    )


@router.post("/contract-draft")
async def export_contract_draft(req: ExportTextRequest):
    """导出 AI 生成的合同草案为 Word"""
    import re
    content = req.content.strip()
    if not content:
        return {"error": "合同内容为空"}

    blocks: list[tuple[str, str]] = []
    # 按 ##/### 标题分块
    sections = re.split(r"\n(?=#{2,3}\s)", content)
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        lines = sec.split("\n", 1)
        first = lines[0].strip()
        if first.startswith("#"):
            heading = re.sub(r"^#+\s*", "", first)
            body = lines[1].strip() if len(lines) > 1 else ""
        else:
            heading = ""
            body = sec
        # 去掉 markdown 标记
        body = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", body)
        body = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)
        blocks.append((heading, body))

    if not blocks:
        blocks = [("合同草案", content)]

    try:
        buf = _build_docx(req.title, blocks)
    except Exception as e:
        return {"error": f"文档生成失败: {str(e)}"}

    safe_name = quote(f"{req.title}.docx")
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}"},
    )


@router.post("/consultation")
async def export_consultation(req: ExportChatRequest):
    """导出咨询对话为 Word"""
    blocks: list[tuple[str, str]] = []
    for i, m in enumerate(req.messages):
        role = "用户" if m.get("role") == "user" else "AI 助手"
        blocks.append((f"{role} · 第{i//2+1}轮", m.get("content", "")))

    buf = _build_docx("法律咨询记录", blocks)
    filename = "咨询记录.docx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})
