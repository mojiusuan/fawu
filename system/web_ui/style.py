"""
智能法务系统 —— 企业级设计系统
"""

DESIGN_CSS = """
<style>
/* ========================================
   1. 全局变量与基础
   ======================================== */
:root {
    --primary: #1a3a5c;
    --primary-light: #2c5f8a;
    --primary-dark: #0f2440;
    --accent: #c8a45c;
    --accent-light: #e0c88e;
    --danger: #c0392b;
    --danger-light: #fdecea;
    --warning: #e67e22;
    --warning-light: #fef5e7;
    --success: #27ae60;
    --success-light: #eafaf1;
    --info: #2980b9;
    --info-light: #eaf2f8;
    --bg: #f2f4f7;
    --bg-card: #ffffff;
    --bg-sidebar: #0f2440;
    --bg-sidebar-hover: #1a3550;
    --text: #2c3e50;
    --text-secondary: #6b7c8e;
    --text-light: #95a5a6;
    --text-sidebar: #b8c7d9;
    --text-sidebar-active: #ffffff;
    --border: #e2e6ed;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.10);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --transition: 0.2s ease;
}

/* ========================================
   2. 全局样式
   ======================================== */
.stApp {
    background: var(--bg);
}

/* 主内容区 */
.main .block-container {
    padding-top: 1.5rem;
    padding-bottom: 2rem;
    max-width: 1280px;
}

/* 隐藏 Streamlit 自带英文 */
#MainMenu, footer, header, .stDeployButton {
    visibility: hidden !important;
}
[data-testid="stSidebarNav"] {display: none !important;}

/* ========================================
   3. 侧边栏
   ======================================== */
[data-testid="stSidebar"] {
    background: var(--bg-sidebar) !important;
}

[data-testid="stSidebar"] .block-container {
    padding-top: 1.5rem;
}

[data-testid="stSidebar"] * {
    color: var(--text-sidebar) !important;
}

[data-testid="stSidebar"] h1,
[data-testid="stSidebar"] h2,
[data-testid="stSidebar"] h3 {
    color: var(--text-sidebar-active) !important;
}

[data-testid="stSidebar"] hr {
    border-color: rgba(255,255,255,0.08) !important;
}

/* 侧边栏 radio */
[data-testid="stSidebar"] .stRadio label {
    padding: 0.6rem 0.8rem !important;
    border-radius: var(--radius-sm) !important;
    margin-bottom: 2px !important;
    transition: background var(--transition) !important;
    font-size: 0.95rem !important;
}

[data-testid="stSidebar"] .stRadio label:hover {
    background: var(--bg-sidebar-hover) !important;
}

[data-testid="stSidebar"] .stRadio [data-selected="true"] {
    background: var(--primary-light) !important;
}

[data-testid="stSidebar"] .stRadio [data-selected="true"] * {
    color: var(--text-sidebar-active) !important;
    font-weight: 600 !important;
}

/* ========================================
   4. 卡片组件
   ======================================== */
.card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--transition);
}
.card:hover {
    box-shadow: var(--shadow-md);
}

/* ========================================
   5. 指标卡片
   ======================================== */
.metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.25rem 1.5rem;
    box-shadow: var(--shadow-sm);
    text-align: center;
    transition: all var(--transition);
}
.metric-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

/* ========================================
   6. 按钮
   ======================================== */
.stButton > button {
    border-radius: var(--radius-sm) !important;
    font-weight: 500 !important;
    padding: 0.5rem 1.25rem !important;
    transition: all var(--transition) !important;
    border: none !important;
}
.stButton > button[kind="primary"] {
    background: var(--primary) !important;
    color: white !important;
}
.stButton > button[kind="primary"]:hover {
    background: var(--primary-light) !important;
    box-shadow: var(--shadow-md) !important;
}
.stButton > button:not([kind]) {
    background: var(--bg-card) !important;
    border: 1px solid var(--border) !important;
    color: var(--text) !important;
}
.stButton > button:not([kind]):hover {
    border-color: var(--primary) !important;
    color: var(--primary) !important;
}

/* ========================================
   7. 输入框
   ======================================== */
.stTextInput input, .stTextArea textarea, .stSelectbox select {
    border-radius: var(--radius-sm) !important;
    border: 1px solid var(--border) !important;
    padding: 0.6rem 0.8rem !important;
    font-size: 0.95rem !important;
}

/* ========================================
   8. 标签页
   ======================================== */
.stTabs [data-baseweb="tab-list"] {
    gap: 0.25rem;
    background: var(--bg);
    padding: 0.25rem;
    border-radius: var(--radius-md);
}
.stTabs [data-baseweb="tab"] {
    border-radius: var(--radius-sm) !important;
    padding: 0.55rem 1.25rem !important;
    font-weight: 500 !important;
    font-size: 0.93rem !important;
}
.stTabs [aria-selected="true"] {
    background: var(--bg-card) !important;
    box-shadow: var(--shadow-sm);
}

/* ========================================
   9. 展开面板
   ======================================== */
.streamlit-expanderHeader {
    border-radius: var(--radius-sm) !important;
    font-weight: 500 !important;
    background: var(--bg) !important;
    border: 1px solid var(--border) !important;
}

/* ========================================
   10. 指标数值
   ======================================== */
[data-testid="stMetricValue"] {
    font-weight: 700 !important;
    font-size: 1.8rem !important;
    color: var(--primary) !important;
}
[data-testid="stMetricDelta"] {
    font-size: 0.9rem !important;
}

/* ========================================
   11. 表格
   ======================================== */
[data-testid="stTable"] table, .stDataFrame table {
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
}
[data-testid="stTable"] th, .stDataFrame th {
    background: var(--bg) !important;
    color: var(--text) !important;
    font-weight: 600 !important;
    font-size: 0.85rem !important;
    padding: 0.7rem 1rem !important;
}

/* ========================================
   12. 消息提示
   ======================================== */
.stSuccess, .stError, .stWarning, .stInfo {
    border-radius: var(--radius-sm) !important;
}

/* ========================================
   13. 聊天消息
   ======================================== */
[data-testid="stChatMessage"] {
    border-radius: var(--radius-md) !important;
}

/* ========================================
   14. 响应式间距
   ======================================== */
@media (max-width: 768px) {
    .main .block-container { padding: 1rem; }
}

/* ========================================
   15. 滚动条
   ======================================== */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-light); }
</style>
"""


def inject_css():
    """在每个页面顶部调用，注入设计系统 CSS"""
    import streamlit as st
    st.markdown(DESIGN_CSS, unsafe_allow_html=True)
