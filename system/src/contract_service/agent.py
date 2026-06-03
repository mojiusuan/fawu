"""
合同处理 Agent —— 合同审查 / 条款比对 / 合同生成
"""
import hashlib
import json

from src.utils.llm_client import llm_client
from src.config import settings
from src.rag_service.retriever import hybrid_retriever
from src.knowledge_graph.query import kg_query
from src.knowledge_graph.builder import graph_builder
from src.audit_service.logger import audit_logger
from src.contract_service.models import ClauseInfo, RiskLevel


# ========== Prompt 模板 ==========
# 这些模板也可从 prompts/ 目录加载
CONTRACT_REVIEW_SYSTEM = """你是合同审查专家，专注识别合同中的风险条款。你的角色是"风险提示者"而非"决策者"——指出风险并提供修改方向，但最终决策由律师做出。

## 审查原则
1. 逐条审查，标注风险等级（高/中/低）
2. 每个风险点必须引用现行法律依据
3. 修改建议需具备可操作性
4. 不确定的事项明确标注"建议进一步核实"

## 风险等级定义
- 高风险: 违反法律强制性规定、显失公平、可能导致条款无效
- 中风险: 权利义务不对等、管辖约定不明、违约责任过重
- 低风险: 表述不够严谨、存在歧义、程序性瑕疵

## 安全护栏
- 不提供胜诉率评估或判决结果预测
- 不编造法律条文编号
- 不提供规避法律监管的具体方案
- 不替代律师出具正式法律意见"""

CLAUSE_COMPARE_SYSTEM = """你是合同比较分析专家。对比两份合同中对应条款的差异，标注实质性差异和形式差异。

## 比较原则
1. 关注实质性差异，忽略纯标点、排版差异
2. 对每个实质性差异标注对哪一方有利
3. 引用现行法律说明差异可能带来的法律后果"""

DOC_GENERATE_SYSTEM = """你是法律文书起草助理。按照中国法律文书格式规范起草合同草稿。合同中的关键信息用 [ ] 标注为待填写项。

## 起草原则
1. 合同结构完整，包含必备条款
2. 条款表述严谨，避免歧义
3. 符合中国合同法律规范
4. 需确认的信息用 [ ] 标注"""


class ContractAgent:
    """合同处理 Agent"""

    def __init__(self):
        self.client = llm_client

    async def review_contract(
        self, contract_id: str, title: str, contract_type: str, clauses: list[ClauseInfo]
    ) -> tuple[list[ClauseInfo], str]:
        """
        审查合同

        Returns:
            (审查后的条款列表, 综合建议)
        """
        reviewed_clauses = []

        for clause in clauses[:10]:  # 最多审查 10 条
            # 1. RAG 检索相关法律法规
            law_results = await hybrid_retriever.search_laws(
                f"{contract_type} {clause.clause_number} {clause.content[:100]}"
            )

            # 2. 组装审查 Prompt
            law_context = "\n".join(
                [f"- {r.get('source', '')} {r.get('article', '')}: {r.get('excerpt', '')}" for r in law_results[:5]]
            )

            review_prompt = f"""请审查以下{contract_type}的条款：

**条款**: {clause.clause_number}
**内容**: {clause.content}

**相关法律法规**:
{law_context if law_context else "（未检索到直接相关法规）"}

请分析风险等级（high/medium/low/none），并给出分析、法律依据和修改建议。
输出 JSON 格式：
{{"risk_level": "high/medium/low/none", "risk_analysis": "风险分析", "law_basis": "法律依据", "suggestion": "修改建议"}}"""

            response, usage = await self.client.generate(
                system_prompt=CONTRACT_REVIEW_SYSTEM,
                user_prompt=review_prompt,
                temperature=0.1,
            )

            # 3. 解析响应
            try:
                # 提取 JSON
                json_str = response
                if "```" in response:
                    json_str = response.split("```")[1]
                    if json_str.startswith("json"):
                        json_str = json_str[4:]
                result = json.loads(json_str.strip())
            except (json.JSONDecodeError, IndexError):
                result = {"risk_level": "none", "risk_analysis": "无法解析", "law_basis": "", "suggestion": ""}

            clause.risk_level = RiskLevel(result.get("risk_level", "none"))
            clause.risk_analysis = result.get("risk_analysis", "")
            clause.law_basis = result.get("law_basis", "")
            clause.suggestion = result.get("suggestion", "")
            reviewed_clauses.append(clause)

            # 记录审计
            audit_logger.log(
                user_id="system",
                case_id=contract_id,
                task_type="contract_review",
                prompt_version="contract-review-v1.0.0",
                model=settings.llm_model,
                model_params={"temperature": 0.1, "max_tokens": settings.LLM_MAX_TOKENS},
                input_text=clause.content,
                rag_queries=[f"{contract_type} {clause.clause_number}"],
                rag_results=law_results[:5],
                output_text=json.dumps(result, ensure_ascii=False),
                latency_ms=usage.get("latency_ms", 0),
                token_usage=usage,
            )

        # 生成综合建议
        summary_prompt = self._build_summary_prompt(reviewed_clauses, title)
        summary_response, _ = await self.client.generate(
            system_prompt=CONTRACT_REVIEW_SYSTEM,
            user_prompt=summary_prompt,
            temperature=0.1,
        )

        return reviewed_clauses, summary_response

    def _build_summary_prompt(self, clauses: list[ClauseInfo], title: str) -> str:
        risks = []
        for c in clauses:
            if c.risk_level != RiskLevel("none"):
                risks.append(
                    f"- {c.clause_number}: [{c.risk_level.value}] {c.risk_analysis}"
                )
        risk_text = "\n".join(risks) if risks else "未发现明显风险"

        return f"""合同《{title}》审查完毕。请生成综合建议。

识别到的风险点：
{risk_text}

请给出：
1. 重点关注事项
2. 谈判建议
3. 需进一步核实的事项
输出简洁的 Markdown 格式。"""

    async def compare_contracts(
        self, title_a: str, clauses_a: list[ClauseInfo], title_b: str, clauses_b: list[ClauseInfo]
    ) -> list[dict]:
        """比对两份合同的条款差异"""
        diffs = []
        max_len = max(len(clauses_a), len(clauses_b))

        for i in range(min(max_len, 10)):
            content_a = clauses_a[i].content if i < len(clauses_a) else ""
            content_b = clauses_b[i].content if i < len(clauses_b) else ""
            num_a = clauses_a[i].clause_number if i < len(clauses_a) else ""
            num_b = clauses_b[i].clause_number if i < len(clauses_b) else ""

            if content_a == content_b:
                diffs.append({"clause": num_a or num_b, "type": "identical", "detail": "内容一致"})
            else:
                compare_prompt = f"""对比以下两个版本的条款：

**合同A**: {num_a}
{content_a[:500]}

**合同B**: {num_b}
{content_b[:500]}

判断差异类型（formal=形式差异 或 substantive=实质性差异），分析对哪方有利。
输出 JSON: {{"type": "formal/substantive", "detail": "差异说明", "favor": "甲方/乙方/无"}}"""

                response, _ = await self.client.generate(
                    system_prompt=CLAUSE_COMPARE_SYSTEM,
                    user_prompt=compare_prompt,
                    temperature=0.1,
                )
                try:
                    result = json.loads(response.strip().split("```")[1] if "```" in response else response.strip())
                except (json.JSONDecodeError, IndexError):
                    result = {"type": "formal", "detail": "无法自动判断", "favor": "无"}

                result["clause"] = num_a or num_b
                diffs.append(result)

        return diffs

    async def generate_contract(
        self, contract_type: str, party_a: str, party_b: str, key_terms: str
    ) -> str:
        """生成合同草案"""
        prompt = f"""请起草一份{contract_type}：

**甲方**: {party_a}
**乙方**: {party_b}
**关键要求**: {key_terms if key_terms else "标准条款"}

请包含以下必备条款：
1. 合同主体信息
2. 合同标的/服务内容
3. 价款与支付方式
4. 履行期限与方式
5. 双方权利义务
6. 违约责任
7. 争议解决
8. 合同生效与变更

用 [ ] 标注需填写的信息。"""

        response, _ = await self.client.generate(
            system_prompt=DOC_GENERATE_SYSTEM,
            user_prompt=prompt,
            temperature=0.3,
            max_tokens=4096,
        )

        # 添加免责声明
        response += "\n\n---\n> ⚠️ 本文件为 AI 辅助生成草稿，需经执业律师审核确认后方可使用。"

        return response


contract_agent = ContractAgent()
