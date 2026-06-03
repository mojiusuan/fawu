---
name: legal-prompt
description: 法律场景 Prompt 工程 —— 合同审查、条款比对、风险评估、法律文书生成的 prompt 模板管理与效果评测，支持开发模式辅助代码生成。
---

# Legal Prompt — 法律场景 Prompt 工程

## 触发条件
- 用户需要"合同审查""风险评估""条款比对""法律意见书""起诉状/答辩状"
- 用户问"这个 prompt 怎么调""为什么 AI 输出不稳定"
- 需要管理 prompt 版本、对比不同 prompt 效果
- 开发模式触发："生成代码""设计Prompt""审查设计""调优参数"

## 设计原则

### 1. 角色锚定
法律 AI 必须明确身份边界，不能既当法官又当律师：
- **审查模式**："你是合同审查助理，识别风险条款并标注风险等级，不提供法律建议"
- **咨询模式**："你是法律研究员，基于现行法律检索结果回答问题，不确定时说'需要进一步确认'"
- **文书模式**："你是法律文书起草助手，按指定格式生成文书草稿，保留 [ ] 占位符供律师填写"

### 2. 结构化输出
法律场景的输出必须可解析、可追溯：
```
【审查结论】
风险等级：高/中/低
涉及条款：第X条
风险类型：违约责任不对等 / 管辖约定不明 / 免责范围过宽
【法律依据】
法规名称 + 条款编号 + 原文引用
【修改建议】
原文：...
建议修改为：...
理由：...
【补充说明】
（如有需要进一步确认的事项）
```

### 3. 不确定性表达
法律不存在绝对答案，prompt 必须引导 AI 合理表达不确定性：
- ✅ "根据现行法律规定，..."
- ✅ "实践中存在两种观点：..."
- ✅ "建议就 XX 事项进一步核实"
- ❌ "你肯定能赢"
- ❌ "这绝对违法"

### 4. 安全护栏
Prompt 中必须嵌入的约束：
```
禁止行为：
- 不得提供胜诉率评估或判决结果预测
- 不得建议用户伪造证据或隐瞒事实
- 不得提供规避法律监管的具体方案
- 不得替代律师出具正式法律意见
```

## 模板结构

每个 prompt 模板包含以下元素：
```yaml
name: contract-review-v1
task: 合同审查
version: 1.2.0
model: claude-opus-4-7
params:
  temperature: 0.1        # 法律场景低温度，减少随机性
  max_tokens: 4096
system_prompt: |
  你是合同审查专家，专注识别条款风险...
user_prompt_template: |
  请审查以下{合同类型}的第{条款范围}：
  {合同文本}
output_schema: review_result  # 引用约定的输出结构
evaluated: true               # 是否经过评测
eval_score: 0.92
```

## 评测方法

### 评测维度
| 维度 | 说明 | 权重 |
|------|------|------|
| 事实准确 | 法条引用、案例引用是否准确 | 40% |
| 风险覆盖 | 关键风险是否被识别（不漏检） | 30% |
| 建议可行 | 修改建议是否可落地 | 20% |
| 格式规范 | 输出结构是否符合约定 | 10% |

### 评测流程
1. 法务专家标注 50-100 个 golden cases（含预期输出）
2. 每个 prompt 版本跑全量评测集
3. 对比不同模型（sonnet/opus/haiku）、不同参数（temperature/top_p）的效果
4. 输出评测报告，标记退化 case

## 版本管理
- Prompt 模板纳入 Git 管理，与代码同步版本
- 每次修改记录：改了什么、为什么改、评测分数变化
- 生产环境锁定版本号，不随 main 分支自动更新

---

## Dev 模式：辅助系统开发

当用户进行"智能法务系统"代码开发时，本 skill 支持以下开发辅助功能：

### generate_code / 生成代码

根据模块设计文档生成符合项目规范的 Python 代码。

**代码生成规范**：
- FastAPI 路由使用 `APIRouter`，注册到 `src/main.py`
- 数据模型使用 `Pydantic BaseModel`
- Agent 类基于 LangChain/LangGraph，工具用 `@tool` 装饰器
- 所有模块包包含 `__init__.py`
- 标准导入约定：
  - `from src.config import settings` — 全局配置
  - `from src.utils.llm_client import LLMClient` — LLM 调用
  - `from src.audit_service.logger import AuditLogger` — 审计日志
  - `from src.rag_service.retriever import HybridRetriever` — RAG 检索
  - `from src.knowledge_graph.query import KGQuery` — 图谱查询

**代码模式参考**：
```python
# routes.py - FastAPI 路由模式
from fastapi import APIRouter
from .models import ContractUploadRequest, ContractReviewResponse
from .service import ContractService

router = APIRouter(prefix="/api/contracts", tags=["合同管理"])

@router.post("/review/{contract_id}")
async def review_contract(contract_id: str) -> ContractReviewResponse:
    ...
```

### design_prompt / 设计Prompt

为系统模块设计运行时的法律 Prompt 模板。模板存储在 `prompts/` 目录下，遵循标准格式（YAML frontmatter + System Prompt + User Prompt Template + Output Schema）。

### review_design / 审查设计

审查已生成的代码或设计方案的合理性和完整性。

### optimise_config / 调优参数

推荐最优模型参数组合。法律场景默认参数：
- **合同审查/风险评估**：temperature=0.1, max_tokens=4096
- **法律咨询/文书生成**：temperature=0.3, max_tokens=8192
- **信息提取/KG构建**：temperature=0.0, max_tokens=2048
