"""
Agent 状态定义 —— LangGraph State
"""
from typing import Annotated, Any
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class AgentState(TypedDict):
    """Agent 共享状态"""

    # 用户输入
    user_input: str
    # 任务类型: contract_review / consultation / rpa / kg_query
    task_type: str
    # 消息历史
    messages: Annotated[list, add_messages]
    # 当前执行的 Agent
    next_agent: str
    # 中间结果（Agent 间传递数据）
    context: dict[str, Any]
    # 最终结果
    result: str
    # 是否完成
    finished: bool
