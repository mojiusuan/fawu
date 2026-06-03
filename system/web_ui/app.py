"""
智能法务系统 · Streamlit 主入口
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st
from style import inject_css
from components.nav import render_sidebar

# ---- 页面配置 ----
st.set_page_config(
    page_title="智能法务系统",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded",
)

inject_css()


# ========================================================================
# 首页函数（必须在路由调用前定义）
# ========================================================================
def _home():
    st.markdown("""
    <div style="margin-bottom:2rem;">
        <div style="font-size:1.7rem;font-weight:700;color:var(--primary-dark);">智能法务系统</div>
        <div style="font-size:0.9rem;color:var(--text-secondary);margin-top:0.25rem;">
            基于大语言模型与智能体技术 · 企业级法务管理平台
        </div>
    </div>
    """, unsafe_allow_html=True)

    # 三列能力卡片
    c1, c2, c3 = st.columns(3)
    for col, icon, title, desc in [
        (c1, "📄", "合同智能管理", "上传即审 · 自动风险识别 · 条款比对 · AI 草案生成"),
        (c2, "💬", "全天候法律咨询", "7×24 在线 · RAG 增强检索 · 法律依据可追溯 · 多轮对话"),
        (c3, "🔍", "知识图谱引擎", "Neo4j 图数据库 · 自动实体抽取 · 判例追溯 · 关联可视化"),
    ]:
        with col:
            st.markdown(f"""
            <div class="metric-card">
                <div style="font-size:2rem;">{icon}</div>
                <div style="font-size:1.2rem;font-weight:700;color:var(--primary);margin:0.4rem 0;">{title}</div>
                <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">{desc}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # 三个标签页
    st.markdown("### 核心能力")
    t1, t2, t3 = st.tabs(["🤖 AI 引擎", "🏗 技术架构", "🛡 安全合规"])

    with t1:
        st.markdown("""
        | 能力 | 技术 | 说明 |
        |------|------|------|
        | Claude / GPT-4o 双引擎 | LangChain 统一封装 | 法律文本深度理解，支持多模型热切换 |
        | 合同审查 Agent | RAG + KG + LLM 协同 | 逐条风险分析，高/中/低三级标注，附带法律依据与修改建议 |
        | 法律咨询 Agent | BM25 + 语义混合检索 | 回答可追溯至具体法条，支持多轮追问 |
        | 知识抽取引擎 | LLM + Neo4j | 从法规/判例/合同自动抽取实体和关系 |
        | RPA 自动化 | LLM + Playwright | 文档数据提取、表单自动填充、批量处理 |
        """)

    with t2:
        st.markdown("""
        | 层次 | 选型 | 用途 |
        |------|------|------|
        | API 网关 | FastAPI 0.111 | 高性能异步 REST API |
        | 智能体框架 | LangGraph | Supervisor 模式多 Agent 编排 |
        | 知识图谱 | Neo4j 5.20 | Cypher 图查询 + 内置可视化 |
        | 向量存储 | ChromaDB | 语义级相似度检索 |
        | 全文检索 | Whoosh | BM25 精确关键词匹配 |
        | 前端界面 | Streamlit 1.35 | 企业级数据驱动界面 |
        """)

    with t3:
        st.markdown("""
        | 措施 | 实现 |
        |------|------|
        | 全链路审计 | 每次 AI 调用记录完整决策链路：输入 → RAG 检索 → 输出 → 模型参数 |
        | 安全护栏 | System Prompt 硬编码禁止项：不预测胜诉、不编造法条、不规避法律 |
        | 数据脱敏 | 原始文本 SHA256 哈希存储，不可逆还原 |
        | 日志防篡改 | Append-only JSONL 格式，写入后不可修改 |
        | 引用追溯 | 每条法律依据标注：法规名称 + 条款号 + 施行日期 + 原文摘录 |
        | 免责声明 | 全部 AI 输出自动附加"不构成正式法律意见，需律师审核" |
        """)

    st.markdown("<br>", unsafe_allow_html=True)

    # 快速入口
    st.markdown("### 快速操作")
    q1, q2, q3, q4 = st.columns(4)
    with q1:
        if st.button("📄  上传合同", use_container_width=True, key="qk_upload"):
            st.switch_page("pages/01_contract.py")
    with q2:
        if st.button("💬  法律咨询", use_container_width=True, key="qk_consult"):
            st.switch_page("pages/02_consultation.py")
    with q3:
        if st.button("🔍  查看图谱", use_container_width=True, key="qk_kg"):
            st.switch_page("pages/03_knowledge_graph.py")
    with q4:
        if st.button("⚙️  系统配置", use_container_width=True, key="qk_config"):
            st.switch_page("pages/06_settings.py")


# 侧边栏导航
render_sidebar("home")

# 直接渲染首页（不再路由，因为首页内容就在此文件）
_home()
