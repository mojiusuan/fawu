"""
法律咨询 Agent —— 24/7 法律问题解答
"""
import hashlib

from src.utils.llm_client import llm_client
from src.config import settings
from src.rag_service.retriever import hybrid_retriever
from src.audit_service.logger import audit_logger
from src.consultation_service.models import SearchResult


CONSULTATION_SYSTEM = """你是智能法律咨询助手。基于现行中国法律法规，回答用户的法律问题。

## 回答原则
1. 所有法律依据必须可追溯，标注法规名称和条款编号
2. 引用判例时标注案号和裁判日期
3. 超过 5 年的判例提示"不排除已有新规或裁判观点变化"
4. 不确定的事项明确标注"建议咨询专业律师"
5. 用通俗语言解释法律概念，但不得曲解法律原意

## 安全护栏
- 不提供胜诉率评估或判决预测
- 不编造法律条文编号
- 不提供规避法律监管的方案
- 不替代律师出具正式法律意见"""


class ConsultationAgent:
    """法律咨询 Agent"""

    def __init__(self):
        self.client = llm_client

    async def ask(self, question: str, source_type: str = "全部") -> tuple[str, list[SearchResult], list[str], str]:
        """
        解答法律问题

        Returns:
            (回答, 检索结果, 法律依据列表, audit_id)
        """
        # 1. RAG 检索
        search_results = await hybrid_retriever.search(
            query=question,
            source_type=source_type,
            top_k=8,
        )

        # 2. 构建上下文
        context_parts = []
        law_basis = []
        for r in search_results:
            source = r.get("source", "")
            article = r.get("article", "")
            excerpt = r.get("excerpt", "")
            if article:
                law_basis.append(f"{source} {article}")
            context_parts.append(f"**[{source}]** {article}\n{excerpt}")

        context = "\n\n---\n".join(context_parts[:8])

        # 3. LLM 生成回答
        prompt = f"""问题: {question}

## 检索到的法律依据
{context if context else "（未检索到直接相关的法律依据，请诚实告知用户）"}

请基于检索结果回答用户的问题。如果检索结果不充分，请诚实告知。
回答需包含：
1. 直接回答
2. 法律依据引用
3. 相关建议
4. 如需进一步核实的事项"""

        answer, usage = await self.client.generate(
            system_prompt=CONSULTATION_SYSTEM,
            user_prompt=prompt,
            temperature=0.3,
            max_tokens=2048,
        )

        # 4. 记录审计
        audit_id = audit_logger.log(
            user_id="anonymous",
            case_id="consultation",
            task_type="legal_consultation",
            prompt_version="consultation-v1.0.0",
            model=settings.llm_model,
            model_params={"temperature": 0.3, "max_tokens": 2048},
            input_text=question,
            rag_queries=[question],
            rag_results=search_results[:8],
            output_text=answer,
            latency_ms=usage.get("latency_ms", 0),
            token_usage=usage,
        )

        # 5. 格式化结果
        formatted_results = []
        for r in search_results:
            formatted_results.append(
                SearchResult(
                    source=r.get("source", ""),
                    article=r.get("article", ""),
                    excerpt=r.get("excerpt", ""),
                    full_content=r.get("full_content", ""),
                    date=r.get("date", ""),
                    relevance=r.get("relevance", "中"),
                )
            )

        return answer, formatted_results, law_basis, audit_id


consultation_agent = ConsultationAgent()
