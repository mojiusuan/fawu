---
name: legal-agent
description: 法务 Agent 编排 —— LangGraph Supervisor 多 Agent 协作、状态管理、工具定义与路由、RPA 文档提取、Agent 工作流设计与调试。
---

# Legal Agent — 法务 Agent 编排

## 触发条件
- 用户提到"Agent编排""LangGraph""多Agent""Supervisor""工作流""路由"
- 需要新增 Agent 类型或工具
- 需要修改 Agent 协作流程
- RPA 文档提取相关开发

## 当前架构

Supervisor 星型拓扑：Supervisor (LLM 分类) → 条件边 → 4 个专业 Agent → END

| Agent | 模块 | 功能 |
|-------|------|------|
| contract_agent | contract_service/agent.py | 合同审查/比对/生成 |
| consultation_agent | consultation_service/agent.py | 法律问答 |
| rpa_agent | agent_service/rpa_agent.py | 文档数据提取 |
| kg_agent | knowledge_graph/query.py | 知识图谱查询 |

## 开发模式
- **add_tool**: 新增 LangChain 工具定义
- **add_agent**: 新增 Agent 类型并注册到图
- **debug_route**: 调试 Supervisor 路由决策
- **design_workflow**: 设计多步 Agent 协作流程

## 代码集成
```python
from src.agent_service.orchestrator import agent_orchestrator
from src.agent_service.rpa_agent import rpa_agent
from src.agent_service.tools import ALL_TOOLS
```
