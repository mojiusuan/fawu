"""
法律咨询 Agent —— 24/7 法律问题解答
"""
import hashlib

from src.utils.llm_client import llm_client
from src.config import settings
from src.rag_service.retriever import hybrid_retriever
from src.audit_service.logger import audit_logger
from src.consultation_service.models import SearchResult


CONSULTATION_SYSTEM = """你是智能法律咨询助手"法小智"，一位专业、耐心且易于沟通的 AI 法律顾问。你的回答风格应当亲切但不失专业。

## 回答格式规范
请按以下结构组织回答，使内容清晰易读：

### 一、直接回答
用通俗易懂的语言直接回应用户的问题核心。先给结论，再解释。

### 二、法律依据
引用相关法律法规，格式为：
- **《法规名称》第X条**：条文要点
每项法律依据单独一行，便于用户查阅。

### 三、实操建议
给出具体可操作的下一步建议，使用编号列表：
1. 第一步做什么
2. 第二步做什么
3. 需要准备什么材料

### 四、注意事项
- 提醒用户可能忽略的关键点
- 如果涉及时效，明确标注
- 不确定的事项标注"建议进一步咨询专业律师"

## 回答风格
- 使用"您"而非"你"，体现尊重
- 避免大段法律术语堆砌，关键术语附带通俗解释
- 涉及金额、期限等关键数字时使用**加粗**突出
- 每条建议不超过2行，保持简洁

## 安全护栏
- 不提供胜诉率评估或判决预测
- 不编造法律条文编号
- 不提供规避法律监管的方案
- 不替代律师出具正式法律意见"""


class ConsultationAgent:
    """法律咨询 Agent"""

    def __init__(self):
        self.client = llm_client

    async def ask(self, question: str, source_type: str = "全部",
                  user_id: str = "anonymous") -> tuple[str, list[SearchResult], list[str], str]:
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
        prompt = f"""用户问题: {question}

## 检索到的法律依据（请优先引用）
{context if context else "（未检索到直接相关的法律依据，请诚实告知用户并建议咨询专业律师）"}

请按以下结构回答（使用 Markdown 格式）：

### 一、直接回答
[先给出明确结论]

### 二、法律依据
[引用相关法条]

### 三、实操建议
[给出具体步骤]

### 四、注意事项
[提醒关键点]

请用亲切专业的口吻，像一位耐心的法律顾问在对话。"""

        answer, usage = await self.client.generate(
            system_prompt=CONSULTATION_SYSTEM,
            user_prompt=prompt,
            temperature=0.3,
            max_tokens=2048,
        )

        # 4. 记录审计
        audit_id = audit_logger.log(
            user_id=user_id,
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
