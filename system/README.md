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
| 知识图谱 | Neo4j 5.20 | Cypher 图查询 + 内置可视化（可选，未启动时自动降级） |
| 向量数据库 | ChromaDB | 语义级相似度检索 |
| 全文检索 | Whoosh | BM25 精确关键词匹配 |
| 文档解析 | python-docx + pdfplumber + PyPDF2 | 多格式合同/法律文书解析 |

## 前置条件

- **Python 3.11+** （必需）
- **LLM API Key**（必需，至少一个）：[DeepSeek](https://platform.deepseek.com/)（推荐，国内可用）/ [Anthropic](https://console.anthropic.com/) / [OpenAI](https://platform.openai.com/)
- **Neo4j Desktop**（可选）：仅知识图谱功能需要，[下载地址](https://neo4j.com/download/)

## 快速开始

### 一键安装（推荐）

**Windows:**
```powershell
cd system
setup.bat
```

**Mac / Linux:**
```bash
cd system
chmod +x setup.sh
./setup.sh
```

脚本会自动完成：创建虚拟环境 → 安装依赖 → 配置环境 → 初始化知识库。完成后按提示编辑 `.env` 填写 API Key 即可。

### 手动安装

```powershell
cd system
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
playwright install chromium
copy .env.example .env         # 然后编辑 .env，填写 DEEPSEEK_API_KEY
python scripts/init_knowledge_base.py
```

### 启动系统

```powershell
python -m src.main
```

浏览器打开 `http://localhost:8000`，API 文档在 `http://localhost:8000/docs`。

### 启动知识图谱（可选）

1. 下载安装 [Neo4j Desktop](https://neo4j.com/download/)
2. 创建本地 DBMS（5.x 版本），使用默认密码 `legaladmin123`
3. 重新运行 `python scripts/init_knowledge_base.py`

Neo4j 未启动时系统会自动降级，合同审查、法律咨询、RAG 检索等核心功能不受影响。

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
├── setup.bat / setup.sh       # 一键安装脚本
└── requirements.txt
```

## 核心功能

| 功能 | 说明 | 依赖 |
|------|------|------|
| 合同管理 | 上传/解析/AI审查（风险分级+法律依据+修改建议）/条款比对/合同生成 | LLM API |
| 智能咨询 | 24/7 法律问答，RAG 混合检索增强，引用可追溯至具体法条 | LLM API |
| 知识图谱 | Neo4j 8种实体+12种关系，LLM自动抽取，判例追溯 | Neo4j（可选） |
| Agent 编排 | LangGraph Supervisor 模式，4 个专业 Agent 协作 | LLM API |
| RPA 自动化 | 合同数据提取（支持 DOCX/PDF/TXT），批量关键条款挖掘 | Playwright |
| 合规审计 | 全链路 AI 决策追溯，SHA256 脱敏，Append-only 防篡改 | 无 |
| 系统配置 | 前端可视化配置 LLM 提供商/模型/API Key/数据库连接 | 无 |

## API 文档

启动后访问 `http://localhost:8000/docs` 查看 Swagger 交互式文档。

## 故障排除

| 问题 | 解决方法 |
|------|----------|
| 启动后无法使用 AI 功能 | 检查 `.env` 中是否填写了 `DEEPSEEK_API_KEY` |
| 知识图谱页面无数据 | 需启动 Neo4j Desktop 并创建 DBMS，然后重新运行 `python scripts/init_knowledge_base.py` |
| 首次启动缓慢 | 正在下载本地嵌入模型（约 1.3GB），仅首次需要，之后秒加载 |
| 国内模型下载慢 | 在 `.env` 中设置 `HF_ENDPOINT=https://hf-mirror.com` |
| ChromaDB 报错 | 部分 Windows 需安装 [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)。如仍有问题，尝试 `pip install chromadb --force-reinstall` 获取预编译版本 |
| 端口被占用 | 在 `.env` 中修改 `PORT` 为其他端口 |
