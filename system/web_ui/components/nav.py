"""
共享侧边栏导航组件 · 所有页面统一调用
"""
import streamlit as st
import requests


def render_sidebar(current_page: str = ""):
    """渲染统一侧边栏，current_page 用于高亮当前页"""

    with st.sidebar:
        # Logo
        st.markdown("""
        <div style="display:flex;align-items:center;gap:10px;padding:0.2rem 0 1rem 0;">
            <div style="min-width:42px;height:42px;background:#c8a45c;border-radius:10px;
                        display:flex;align-items:center;justify-content:center;font-size:22px;">⚖️</div>
            <div>
                <div style="font-size:1.05rem;font-weight:700;color:#fff;">智能法务系统</div>
                <div style="font-size:0.7rem;color:#6a8;letter-spacing:1px;">LEGAL AI PLATFORM</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")

        # 导航项
        NAV_ITEMS = [
            ("🏠  系统首页",     "home"),
            ("📄  合同管理",     "contract"),
            ("💬  智能咨询",     "consultation"),
            ("🔍  知识图谱",     "kg"),
            ("📊  审计报告",     "audit"),
            ("🤖  自动化工具",    "rpa"),
            ("⚙️  系统配置",     "settings"),
        ]

        for label, key in NAV_ITEMS:
            # 高亮当前页
            if key == current_page:
                st.markdown(f"""
                <div style="background:var(--primary-light);padding:0.55rem 0.8rem;
                            border-radius:6px;margin-bottom:2px;font-size:0.92rem;
                            font-weight:600;color:#fff !important;cursor:default;">
                    {label}
                </div>
                """, unsafe_allow_html=True)
            else:
                # 用按钮模拟导航
                btn_key = f"nav_{key}"
                if st.button(label, key=btn_key, use_container_width=True,
                             type="secondary" if key != current_page else "primary"):
                    _navigate_to(key)

        st.markdown("---")

        # 状态指示
        try:
            requests.get("http://localhost:8080/api/health", timeout=1)
            st.markdown(
                '<div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:#5a9;">'
                '<span style="width:7px;height:7px;background:#4a8;border-radius:50%;display:inline-block;'
                'box-shadow:0 0 6px rgba(68,170,136,0.6);"></span>服务运行中</div>',
                unsafe_allow_html=True,
            )
        except Exception:
            st.markdown('<div style="font-size:0.78rem;color:#889;">● 服务未连接</div>', unsafe_allow_html=True)

        st.caption("v2.0 · Enterprise")


def _navigate_to(key: str):
    """导航到对应页面"""
    PAGES = {
        "home":          "app",
        "contract":      "pages/01_contract.py",
        "consultation":  "pages/02_consultation.py",
        "kg":            "pages/03_knowledge_graph.py",
        "audit":         "pages/04_audit.py",
        "rpa":           "pages/05_rpa.py",
        "settings":      "pages/06_settings.py",
    }
    target = PAGES.get(key)
    if target == "app":
        # 跳回首页
        st.switch_page("app.py")
    elif target:
        st.switch_page(target)
