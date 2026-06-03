# 智能法务系统

基于大语言模型与智能体技术的智能法务管理平台，集成合同管理、法律咨询、案件分析等功能模块。

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 后端框架 | Python 3.11 + FastAPI | 高性能异步 REST API |
| 前端界面 | HTML5 + CSS3 + JavaScript | 零依赖现代 Web 界面，FastAPI 直接托管 |
| 大语言模型 | DeepSeek V3 / Claude / GPT-4o | 三引擎可切换，默认 DeepSeek |
| 向量嵌入 | BAAI/bge-large-zh-v1.5 | 本地中文模型，免费离线运行 |
| Agent 框架 | LangGraph | Supervisor 模式多 Agent 编排 |
| 知识图谱 | Neo4j 5.20 (Desktop) | Cypher 图查询 + 内置可视化 |
| 向量数据库 | ChromaDB | 语义级相似度检索 |
| 全文检索 | Whoosh | BM25 精确关键词匹配 |
| 文档解析 | python-docx + pdfplumber + PyPDF2 | 多格式合同/法律文书解析 |

## 快速开始

### 1. 环境准备

```powershell
cd d:\babyhomework\fawu\system
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 配置 API Key

```powershell
copy .env.example .env
# 编辑 .env，填写 DEEPSEEK_API_KEY（必填）
# 可选填写 ANTHROPIC_API_KEY、OPENAI_API_KEY
```

### 3. 启动 Neo4j

打开 Neo4j Desktop → 创建/启动本地 DBMS（5.x 版本），默认连接 `neo4j://127.0.0.1:7687`。

### 4. 初始化知识库

```powershell
python scripts/init_knowledge_base.py
```

### 5. 启动系统

```powershell
python -m src.main
```

浏览器打开 `http://localhost:8080`，前端和后端同一端口。

## 项目结构

```
system/
├── src/                       # 后端源码
│   ├── main.py                # FastAPI 入口 + 静态文件托管
│   ├── config.py              # 全局配置管理
│   ├── contract_service/      # 合同管理（上传/审查/比对/生成）
│   ├── consultation_service/  # 法律咨询（RAG 增强问答）
│   ├── knowledge_graph/       # 知识图谱（Neo4j 构建/查询）
│   ├── agent_service/         # Agent 编排 + RPA 自动化
│   ├── rag_service/           # RAG 检索引擎（混合检索）
│   ├── audit_service/         # 审计日志 + 合规报告
│   ├── utils/                 # LLM 统一封装
│   ├── settings_routes.py     # 系统配置 API
│   └── rpa_routes.py          # RPA 自动化 API
├── web/                       # 前端界面
│   ├── index.html             # 完整 SPA 应用
│   ├── css/style.css          # 企业级设计系统
│   └── js/app.js              # 前端业务逻辑
├── knowledge/                 # RAG 知识库
├── data/contracts/            # 示例合同
├── prompts/                   # Prompt 模板
├── docs/                      # 论文文档
├── scripts/                   # 初始化脚本
├── tests/                     # 测试 + 评估
└── requirements.txt
```

## 核心功能

| 功能 | 说明 |
|------|------|
| 合同管理 | 上传/解析/AI审查（风险分级+法律依据+修改建议）/条款比对/合同生成 |
| 智能咨询 | 24/7 法律问答，RAG 混合检索增强，引用可追溯至具体法条 |
| 知识图谱 | Neo4j 8种实体+12种关系，LLM自动抽取，判例追溯 |
| Agent 编排 | LangGraph Supervisor 模式，4 个专业 Agent 协作 |
| RPA 自动化 | 合同数据提取（支持 DOCX/PDF/TXT），批量关键条款挖掘 |
| 合规审计 | 全链路 AI 决策追溯，SHA256 脱敏，Append-only 防篡改 |
| 系统配置 | 前端可视化配置 LLM 提供商/模型/API Key/数据库连接 |

## API 文档

启动后访问 `http://localhost:8080/docs` 查看 Swagger 交互式文档。
