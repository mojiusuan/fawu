---
name: compliance-audit
description: 合规审计追溯 —— 记录每次 AI 决策链路（检索结果、prompt 版本、模型参数），生成审计日志满足合规审查要求，支持开发阶段测试审计链路。
---

# Compliance Audit — 合规审计追溯

## 触发条件
- 用户提到"审计日志""合规追溯""决策链路""谁在什么时候用了什么 prompt"
- 需要向监管/客户证明 AI 系统的可解释性
- 排查 AI 输出问题时需要还原当时的上下文
- 开发模式触发："测试审计""检查日志"

## 为什么法务系统必须做审计追溯

法律 AI 不同于通用 chatbot：
- **监管要求**：部分法域要求 AI 辅助法律决策必须可追溯
- **责任划分**：AI 建议 vs 律师决策的边界需要清晰记录
- **问题复盘**：当 AI 出现错误引用时，必须能回溯到根因（检索问题？prompt 问题？模型幻觉？）

## 审计日志结构

每次 AI 调用记录一条审计日志，包含以下字段：

```json
{
  "audit_id": "uuid",
  "timestamp": "2026-05-13T10:30:00Z",
  "user_id": "lawyer_001",
  "session_id": "case_2024_民初_1234",
  "request": {
    "task_type": "contract_review",
    "prompt_version": "contract-review-v1.2.0",
    "model": "claude-opus-4-7",
    "model_params": {
      "temperature": 0.1,
      "max_tokens": 4096
    },
    "input_text_hash": "sha256_of_input",
    "input_length": 3500
  },
  "context": {
    "rag_results": [
      {"source": "民法典", "article": "第584条", "score": 0.96},
      {"source": "裁判文书", "case_id": "(2023)最高法民终字第XXX号", "score": 0.89}
    ],
    "rag_query": "违约金过高 调整标准",
    "prompt_full": "sha256_of_full_assembled_prompt"
  },
  "response": {
    "output_text_hash": "sha256_of_output",
    "output_length": 1200,
    "finish_reason": "end_turn",
    "latency_ms": 2300,
    "token_usage": {"input": 5000, "output": 800, "cache_hit": 3200}
  },
  "review": {
    "lawyer_action": "adopted_with_edit",
    "lawyer_comment": "违约金调整建议采纳，管辖条款部分改为线下仲裁",
    "reviewed_at": "2026-05-13T11:00:00Z"
  }
}
```

## 存储方案

### 分层存储
| 层级 | 内容 | 保留期 | 存储 |
|------|------|--------|------|
| **热数据** | 近 30 天审计日志 | 30 天 | PostgreSQL/Elasticsearch |
| **温数据** | 30 天 - 2 年 | 2 年 | 对象存储（S3/OSS），Parquet 格式 |
| **冷数据** | 2 年 - 诉讼时效届满 | 按法律规定 | 归档存储，压缩加密 |

> 开发阶段使用 JSONL 文件存储（`logs/audit.jsonl`），生产环境切换为数据库。

### 脱敏策略
- 用户输入原文不存明文，存 SHA256 哈希
- 需要还原时通过哈希反查业务库（权限受控）
- 合同文本/当事人信息等 PII 字段脱敏后存储

## 审计查询接口

```python
# 按案件追溯完整 AI 决策链
GET /audit/session/{session_id}
# 返回该案件下所有 AI 调用的时间线

# 按 prompt 版本查质量趋势
GET /audit/stats?prompt_version=contract-review-v1.2.0
# 返回该版本下的采纳率、平均评分

# 按时间段导出合规报告
POST /audit/export
{
  "start": "2026-01-01",
  "end": "2026-03-31",
  "format": "pdf"
}
```

## 与各模块的集成

- **legal-rag**：记录每次检索的 query + 结果列表，存入 audit.context.rag_results
- **legal-prompt**：记录 prompt_version，通过版本号反查当时的 prompt 模板内容
- **contract_service**：每次合同审查记录完整决策链
- **consultation_service**：每次法律咨询记录检索链和回答

## 合规检查清单

部署前确认：
- [ ] 审计日志是否包含所有必填字段
- [ ] PII 是否正确脱敏
- [ ] 原始输入是否不可从日志中还原
- [ ] 日志是否防篡改（append-only，写入后不可修改）
- [ ] 保留策略是否符合所在法域的法律要求
- [ ] 导出功能是否支持按案件/按时间/按用户维度

---

## Dev 模式：开发阶段测试

### test — 测试审计链路

开发时验证审计日志系统是否正常工作。自动生成测试记录、写入、查询、导出，验证全链路。

### check — 检查日志完整性

检查 `logs/` 目录下所有 JSONL 文件：
- 每行是否为有效 JSON
- 必填字段是否完整
- 与 rag-queries.jsonl 和 prompt-usage.jsonl 的交叉一致性

### 开发集成代码模式

各模块集成审计日志的标准模式：
```python
from src.audit_service.logger import AuditLogger

logger = AuditLogger()

# 记录 AI 调用
logger.log(
    user_id="lawyer_001",
    case_id="(2024)沪01民初1234号",
    task_type="contract_review",
    prompt_version="contract-review-v1.0.0",
    model="claude-sonnet-4-20250514",
    model_params={"temperature": 0.1, "max_tokens": 4096},
    input_text=original_input,
    rag_queries=["违约金调整标准"],
    rag_results=[{"source": "民法典", "article": "第585条", "score": 0.96}],
    output_text=ai_output,
    latency_ms=2300,
    token_usage={"input": 5000, "output": 800, "cache_hit": 3200}
)
```
