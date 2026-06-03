"""
Agent 编排器 —— Supervisor 模式，根据任务类型路由到专业 Agent
"""
import json

from langgraph.graph import StateGraph, END

from src.agent_service.state import AgentState
from src.utils.llm_client import llm_client
from src.config import settings
from src.audit_service.logger import audit_logger


SUPERVISOR_SYSTEM = """你是智能法务系统的任务路由器。分析用户输入，判断应该交给哪个 Agent 处理。

## 可用 Agent
- contract_agent: 合同审查、条款比对、合同生成、风险识别
- consultation_agent: 法律问题解答、法律知识检索、案例查询
- rpa_agent: 文档数据提取、表格填写、自动化操作
- kg_agent: 知识图谱查询、案例关系追溯

## 规则
1. 合同相关 → contract_agent
2. 法律问题咨询 → consultation_agent
3. 数据提取/自动化 → rpa_agent
4. 图谱查询 → kg_agent

输出 JSON: {{"task_type": "contract_review/consultation/rpa/kg_query", "agent": "contract_agent/consultation_agent/rpa_agent/kg_agent", "reason": "理由"}}"""


class AgentOrchestrator:
    """Agent 编排器 —— Supervisor 模式"""

    def __init__(self):
        self.client = llm_client
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """构建 LangGraph 工作流"""
        workflow = StateGraph(AgentState)

        workflow.add_node("supervisor", self._supervisor_node)
        workflow.add_node("contract_agent", self._contract_node)
        workflow.add_node("consultation_agent", self._consultation_node)
        workflow.add_node("rpa_agent", self._rpa_node)
        workflow.add_node("kg_agent", self._kg_node)

        workflow.set_entry_point("supervisor")

        # Supervisor 根据结果路由
        workflow.add_conditional_edges(
            "supervisor",
            self._route,
            {
                "contract_agent": "contract_agent",
                "consultation_agent": "consultation_agent",
                "rpa_agent": "rpa_agent",
                "kg_agent": "kg_agent",
                "end": END,
            },
        )

        # 各 Agent 完成后返回 END
        workflow.add_edge("contract_agent", END)
        workflow.add_edge("consultation_agent", END)
        workflow.add_edge("rpa_agent", END)
        workflow.add_edge("kg_agent", END)

        return workflow.compile()

    async def _supervisor_node(self, state: AgentState) -> dict:
        """Supervisor 节点：分析用户意图，路由任务"""
        user_input = state.get("user_input", "")

        if not user_input:
            return {"next_agent": "end", "finished": True, "result": "无输入"}

        prompt = f"用户输入: {user_input}\n请判断任务类型。"
        response, _ = await self.client.generate(
            system_prompt=SUPERVISOR_SYSTEM,
            user_prompt=prompt,
            temperature=0.0,
        )

        try:
            json_str = response
            if "```" in json_str:
                json_str = json_str.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
            parsed = json.loads(json_str.strip())
        except (json.JSONDecodeError, IndexError):
            # 简单的关键词回退
            if any(w in user_input for w in ["合同", "审查", "条款", "比对"]):
                parsed = {"task_type": "contract_review", "agent": "contract_agent"}
            elif any(w in user_input for w in ["图谱", "知识图谱", "案例关系"]):
                parsed = {"task_type": "kg_query", "agent": "kg_agent"}
            else:
                parsed = {"task_type": "consultation", "agent": "consultation_agent"}

        return {
            "task_type": parsed.get("task_type", "consultation"),
            "next_agent": parsed.get("agent", "consultation_agent"),
            "context": parsed,
        }

    async def _contract_node(self, state: AgentState) -> dict:
        """合同 Agent 节点"""
        return {
            "result": "合同审查 Agent 已接收任务。",
            "finished": True,
        }

    async def _consultation_node(self, state: AgentState) -> dict:
        """咨询 Agent 节点"""
        return {
            "result": "法律咨询 Agent 已接收任务。",
            "finished": True,
        }

    async def _rpa_node(self, state: AgentState) -> dict:
        """RPA Agent 节点"""
        return {
            "result": "RPA Agent 已接收任务。",
            "finished": True,
        }

    async def _kg_node(self, state: AgentState) -> dict:
        """知识图谱 Agent 节点"""
        return {
            "result": "知识图谱 Agent 已接收任务。",
            "finished": True,
        }

    @staticmethod
    def _route(state: AgentState) -> str:
        return state.get("next_agent", "end")

    async def run(self, user_input: str) -> dict:
        """运行 Agent 编排"""
        initial_state: AgentState = {
            "user_input": user_input,
            "task_type": "",
            "messages": [],
            "next_agent": "",
            "context": {},
            "result": "",
            "finished": False,
        }
        result = await self.graph.ainvoke(initial_state)
        return result


agent_orchestrator = AgentOrchestrator()
