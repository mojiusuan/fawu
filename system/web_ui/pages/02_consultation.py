"""
智能法律咨询 · RAG 增强问答
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import requests
from style import inject_css
from components.nav import render_sidebar

inject_css()
render_sidebar("consultation")

API_BASE = "http://localhost:8080"

st.markdown('<div class="page-title">💬 智能法律咨询</div>', unsafe_allow_html=True)
st.caption("基于法律法规知识库的 AI 法律问答 · 回答可追溯 · 支持多轮对话")

# 初始化
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# 对话区
chat_area = st.container()
with chat_area:
    if not st.session_state.chat_history:
        st.markdown("""
        <div style="text-align:center;padding:3rem 1rem;color:var(--text-secondary);">
            <div style="font-size:3rem;margin-bottom:1rem;">⚖️</div>
            <div style="font-size:1.1rem;font-weight:600;color:var(--text);margin-bottom:0.3rem;">欢迎使用智能法律咨询</div>
            <div style="font-size:0.85rem;">请输入法律问题，AI 将基于法律法规和判例知识库为您解答</div>
        </div>
        """, unsafe_allow_html=True)

    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

# 输入栏
st.markdown("---")
input_col, scope_col = st.columns([4, 1])
with input_col:
    question = st.chat_input("在此输入法律问题…")
with scope_col:
    source_type = st.selectbox("检索范围", ["全部", "法规", "判例", "合同"], label_visibility="collapsed")

if question:
    st.session_state.chat_history.append({"role": "user", "content": question})
    with st.chat_message("user"):
        st.markdown(question)

    with st.chat_message("assistant"):
        try:
            with st.spinner("正在检索法律知识库…"):
                resp = requests.post(f"{API_BASE}/api/consultation/ask", json={
                    "question": question, "source_type": source_type,
                }, timeout=120)

            if resp.status_code == 200:
                d = resp.json()
                st.markdown(d["answer"])

                if d.get("law_basis"):
                    with st.expander("📚 法律依据"):
                        for b in d["law_basis"]:
                            st.markdown(f"- {b}")

                if d.get("search_results"):
                    with st.expander("🔍 检索来源"):
                        for r in d["search_results"]:
                            st.caption(f"**{r.get('source','')} {r.get('article','')}**（相关度：{r.get('relevance','中')}）")
                            st.caption(f"> {r.get('excerpt','')[:200]}")

                st.caption(d.get("disclaimer", "本回答不构成正式法律意见，请咨询执业律师。"))
                st.session_state.chat_history.append({"role": "assistant", "content": d["answer"]})
            else:
                st.error(resp.text)
        except requests.ConnectionError:
            fallback = f"后端服务未启动。您的问题是：_{question}_\n\n请启动后端后重试：`python -m src.main`"
            st.markdown(fallback)
            st.session_state.chat_history.append({"role": "assistant", "content": fallback})

# 侧边栏快捷问题
with st.sidebar:
    st.markdown("---")
    st.markdown("#### 📌 快捷问题")
    quick = {
        "违约金标准": "合同违约金约定多少算过高？法律怎么规定的？",
        "合同解除": "什么情况下可以单方解除合同？需要什么程序？",
        "违约责任": "违约责任有哪些承担方式？赔偿范围怎么确定？",
        "诉讼时效": "合同纠纷的诉讼时效是多久？从什么时候开始算？",
        "劳动纠纷": "公司单方面裁员需要支付多少经济补偿？",
    }
    for label, q in quick.items():
        if st.button(f"📝 {label}", key=f"q_{label}"):
            st.session_state.chat_history.append({"role": "user", "content": q})
            st.rerun()

    st.markdown("---")
    if st.button("🔄 清空对话记录", use_container_width=True):
        st.session_state.chat_history = []
        st.rerun()
