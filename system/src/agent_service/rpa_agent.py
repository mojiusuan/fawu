"""
RPA Agent —— 自动化处理重复性法律业务
"""
import json
from pathlib import Path

from src.utils.llm_client import llm_client
from src.rag_service.parser import legal_parser
from src.audit_service.logger import audit_logger
from src.config import settings


RPA_EXTRACT_PROMPT = """分析以下合同文本，提取关键信息。只输出 JSON，不要任何其他文字。

{
  "contract_title": "合同名称",
  "party_a": "甲方全称",
  "party_b": "乙方全称",
  "sign_date": "签署日期(如未提及填'未注明')",
  "amount": "合同金额(如未提及填'未注明')",
  "key_terms": "关键条款一句话摘要",
  "deadline": "履行期限(如未提及填'未注明')",
  "dispute_resolution": "争议解决方式(如未提及填'未注明')"
}

合同文本：
"""


class RPAAgent:
    """RPA 自动化 Agent"""

    def __init__(self):
        self.client = llm_client

    async def extract_contract_data(self, file_path: str) -> dict:
        """从合同文档中提取结构化数据"""
        ext = Path(file_path).suffix.lower()

        if ext == ".docx":
            from docx import Document
            doc = Document(file_path)
            full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif ext == ".pdf":
            try:
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            except Exception:
                from PyPDF2 import PdfReader
                reader = PdfReader(file_path)
                full_text = "\n".join(p.extract_text() or "" for p in reader.pages)
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                full_text = f.read()

        if not full_text.strip():
            return {"error": "未能识别文档中的文字内容"}

        print(f"[RPA] 解析成功 · 文本长度: {len(full_text)} 字符")
        # 打印前500字确认解析正确
        print(f"[RPA] 合同开头:\n{full_text[:500]}")

        # 把合同文本直接塞进 user prompt，要求逐字段提取
        prompt = f"""仔细阅读以下合同全文，尽可能提取信息。如果字段内容未填写（如空白、留空、□未勾选），填"未注明"。如果只描述了角色身份（如"用水单位"），用描述替代。

合同全文：
{full_text[:8000]}

---
请输出 JSON：
{{
  "contract_title": "合同标题（通常在文档开头或第一行）",
  "party_a": "甲方名称（可能是'甲方'、'买方'、'出租方'、'委托方'后的公司名）",
  "party_b": "乙方名称（可能是'乙方'、'卖方'、'承租方'、'受托方'后的公司名）",
  "amount": "合同金额（含数字和单位，如'50万元'）",
  "deadline": "履行期限（如'2024年12月31日前'、'自签署之日起3年'）",
  "dispute_resolution": "争议解决方式（如'向XX法院提起诉讼'、'提交XX仲裁委员会'）"
}}
只输出 JSON："""

        response, usage = await self.client.generate(
            system_prompt="你是合同信息提取器。严格只输出 JSON，不要解释。",
            user_prompt=prompt,
            temperature=0.0,
            max_tokens=512,
        )

        print(f"[RPA] LLM 原始响应:\n{response[:500]}")

        try:
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            result = json.loads(json_str.strip())
            # 把 None / null 替换为 "未注明"
            for k in result:
                if result[k] is None:
                    result[k] = "未注明"
        except (json.JSONDecodeError, IndexError):
            print(f"[RPA] JSON 解析失败:\n{response[:600]}")
            try:
                start = response.index("{")
                end = response.rindex("}") + 1
                result = json.loads(response[start:end])
            except (ValueError, json.JSONDecodeError):
                result = {"error": "AI 返回格式异常", "raw": response[:300]}

        # 审计
        audit_logger.log(
            user_id="system",
            case_id="rpa_extract",
            task_type="rpa_data_extraction",
            prompt_version="rpa-extract-v1.0.0",
            model=settings.llm_model,
            model_params={"temperature": 0.0, "max_tokens": 2048},
            input_text=file_path,
            rag_queries=[],
            rag_results=[],
            output_text=json.dumps(result, ensure_ascii=False),
            latency_ms=usage.get("latency_ms", 0),
            token_usage=usage,
        )

        return result

    async def fill_form(self, template_fields: dict, data: dict) -> dict:
        """自动填充法律表格"""
        filled = {}
        for field, default in template_fields.items():
            filled[field] = data.get(field, default)
        return filled

    async def batch_extract_key_clauses(self, file_paths: list[str]) -> list[dict]:
        """批量提取关键条款"""
        results = []
        for fp in file_paths:
            chunks = legal_parser.parse_to_documents(fp)
            key_clauses = {
                "file": Path(fp).name,
                "total_clauses": len(chunks),
                "key_clauses": [],
            }

            # 找出关键条款（违约责任、争议解决、保密等）
            keywords = ["违约", "赔偿", "争议", "管辖", "保密", "解除", "终止", "不可抗力"]
            for chunk in chunks:
                title = chunk.get("title", "")
                content = chunk.get("content", "")
                combined = title + content
                if any(kw in combined for kw in keywords):
                    key_clauses["key_clauses"].append(
                        {"title": title, "summary": content[:200]}
                    )

            results.append(key_clauses)

        return results


rpa_agent = RPAAgent()
