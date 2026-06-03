"""
侧边栏组件（备用）
"""
import streamlit as st


def render_sidebar():
    """渲染侧边栏"""
    with st.sidebar:
        st.title("⚖️ 智能法务系统")
        st.markdown("---")
        st.markdown("### 系统状态")

        try:
            import requests
            resp = requests.get("http://localhost:8080/api/health", timeout=2)
            if resp.status_code == 200:
                st.success("后端服务：运行中")
            else:
                st.warning("后端服务：异常")
        except Exception:
            st.error("后端服务：未连接")

        st.markdown("---")
        st.markdown("**版本**：v1.0.0")
        st.markdown("**模型**：Claude / GPT-4o")
