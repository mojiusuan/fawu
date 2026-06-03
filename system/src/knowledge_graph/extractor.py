"""
知识抽取器 —— LLM 驱动的实体/关系抽取
"""
import json
import re

from src.utils.llm_client import llm_client
from src.config import settings


EXTRACTION_PROMPT = """你是法律知识图谱构建专家。从以下法律文本中提取实体和关系，输出 JSON 格式。

## 实体类型
- Law: 法律法规 (name, type, effective_date, status)
- Article: 法条 (article_number, content, law_name, chapter)
- Case: 判例 (case_number, title, court, case_date, case_type)
- Contract: 合同 (title, contract_type, party_a, party_b)
- Clause: 条款 (clause_number, content, contract_title, risk_level)
- RiskPoint: 风险点 (risk_type, level, description, law_basis, suggestion)
- LegalConcept: 法律概念 (name, definition)
- Court: 法院 (name, level, jurisdiction)

## 关系类型
- CONTAINS: 包含关系 (Law->Article, Contract->Clause)
- HAS_RISK: 存在风险 (Clause->RiskPoint)
- BASED_ON: 法律依据 (RiskPoint->Article, Clause->Article)
- BELONGS_TO: 属于 (Article->Law)
- CITES: 引用 (Case->Article)
- APPLIES: 适用 (Case->Law)
- HEARD_BY: 审理 (Case->Court)
- RELATED_TO: 关联 (LegalConcept->Article)

## 输出格式
{
  "entities": [
    {"type": "Law", "properties": {"name": "民法典", "law_type": "民事", ...}},
    {"type": "Article", "properties": {"article_number": "第584条", ...}}
  ],
  "relationships": [
    {"source_type": "Law", "source_name": "民法典", "relation": "CONTAINS", "target_type": "Article", "target_name": "第584条"}
  ]
}

## 规则
1. 只提取文本中明确提到的实体，不编造
2. 实体名称使用文本中的原文表述
3. 每个法条必须关联到其所属法规
4. 判例引用的法条用 CITES 关系

## 文本
{text}

请输出 JSON:"""


class KnowledgeExtractor:
    """LLM 驱动的知识抽取器"""

    def __init__(self):
        self.client = llm_client

    async def extract_from_text(self, text: str) -> dict:
        """从文本中抽取实体和关系"""
        prompt = EXTRACTION_PROMPT.format(text=text[:6000])
        response, _ = await self.client.generate(
            system_prompt="你是法律知识抽取专家，精确从文本中提取实体和关系。只返回合法 JSON。",
            user_prompt=prompt,
            temperature=0.0,
            max_tokens=4096,
        )
        return self._parse_response(response)

    async def extract_from_law_document(self, laws: list[dict]) -> dict:
        """从法律文档（条款列表）中抽取"""
        # 法律文档已有结构化格式，直接转换
        entities = []
        relationships = []

        law_names = set()
        for chunk in laws:
            law_name = chunk.get("law", "")
            if law_name and law_name not in law_names:
                law_names.add(law_name)
                entities.append(
                    {
                        "type": "Law",
                        "properties": {
                            "name": law_name,
                            "law_type": "民事",
                            "effective_date": chunk.get("effective_date", ""),
                            "status": chunk.get("status", "现行有效"),
                        },
                    }
                )

            if chunk.get("article"):
                entities.append(
                    {
                        "type": "Article",
                        "properties": {
                            "article_number": chunk["article"],
                            "content": chunk.get("content", ""),
                            "law_name": law_name,
                            "chapter": chunk.get("chapter", ""),
                        },
                    }
                )
                relationships.append(
                    {
                        "source_type": "Law",
                        "source_name": law_name,
                        "relation": "CONTAINS",
                        "target_type": "Article",
                        "target_name": chunk["article"],
                    }
                )

        return {"entities": entities, "relationships": relationships}

    async def extract_from_case(self, case_data: dict) -> dict:
        """从判例数据中构建实体关系"""
        entities = []
        relationships = []

        # Case 实体
        case_number = case_data.get("case_number", "")
        entities.append(
            {
                "type": "Case",
                "properties": {
                    "case_number": case_number,
                    "title": case_data.get("title", ""),
                    "court": case_data.get("court", ""),
                    "case_date": case_data.get("date", ""),
                    "case_type": case_data.get("case_type", ""),
                },
            }
        )

        # Court 实体
        court_name = case_data.get("court", "")
        if court_name:
            entities.append({"type": "Court", "properties": {"name": court_name}})
            relationships.append(
                {
                    "source_type": "Case",
                    "source_name": case_number,
                    "relation": "HEARD_BY",
                    "target_type": "Court",
                    "target_name": court_name,
                }
            )

        # 关联法条
        for law_ref in case_data.get("legal_basis", []):
            relationships.append(
                {
                    "source_type": "Case",
                    "source_name": case_number,
                    "relation": "CITES",
                    "target_type": "Article",
                    "target_name": law_ref,
                }
            )

        return {"entities": entities, "relationships": relationships}

    async def extract_from_contract(
        self, contract_title: str, clauses: list[dict]
    ) -> dict:
        """从合同中抽取（可能需要 LLM 辅助识别风险点）"""
        entities = []
        relationships = []

        # Contract 实体
        entities.append(
            {
                "type": "Contract",
                "properties": {
                    "title": contract_title,
                    "contract_type": "",
                    "party_a": "",
                    "party_b": "",
                },
            }
        )

        for clause in clauses:
            c_title = clause.get("title", "")
            c_content = clause.get("content", "")
            entities.append(
                {
                    "type": "Clause",
                    "properties": {
                        "clause_number": c_title,
                        "content": c_content,
                        "contract_title": contract_title,
                    },
                }
            )
            relationships.append(
                {
                    "source_type": "Contract",
                    "source_name": contract_title,
                    "relation": "CONTAINS",
                    "target_type": "Clause",
                    "target_name": c_title,
                }
            )

        # 尝试用 LLM 识别风险点（仅对较长合同）
        if len(clauses) > 3:
            text_parts = []
            for c in clauses:
                text_parts.append(f"{c['title']}: {c['content'][:200]}")
            review_text = "\n".join(text_parts[:5])

            prompt = f"""分析以下合同条款，识别风险点，输出 JSON：

合同: {contract_title}

{review_text}

格式：
{{
  "risks": [
    {{"clause": "条款名", "risk_type": "风险类型", "level": "high/medium/low", "description": "描述", "law_basis": "法律依据", "suggestion": "建议"}}
  ]
}}"""

            response, _ = await self.client.generate(
                system_prompt="你是合同风险识别专家。JSON only.",
                user_prompt=prompt,
                temperature=0.0,
                max_tokens=2048,
            )
            parsed = self._parse_response(response)

            for risk in parsed.get("risks", []):
                entities.append(
                    {
                        "type": "RiskPoint",
                        "properties": {
                            "risk_type": risk.get("risk_type", ""),
                            "level": risk.get("level", ""),
                            "description": risk.get("description", ""),
                            "law_basis": risk.get("law_basis", ""),
                            "suggestion": risk.get("suggestion", ""),
                        },
                    }
                )
                relationships.append(
                    {
                        "source_type": "Clause",
                        "source_name": risk.get("clause", ""),
                        "relation": "HAS_RISK",
                        "target_type": "RiskPoint",
                        "target_name": risk.get("risk_type", ""),
                    }
                )

        return {"entities": entities, "relationships": relationships}

    @staticmethod
    def _parse_response(response: str) -> dict:
        """从 LLM 响应中提取 JSON"""
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # 尝试提取 JSON 块
            match = re.search(r"\{[\s\S]*\}", response)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            return {}


knowledge_extractor = KnowledgeExtractor()
