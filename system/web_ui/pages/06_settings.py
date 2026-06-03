"""
系统配置 · API & 数据库 & 模型参数
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import requests
from style import inject_css
from components.nav import render_sidebar

inject_css()
render_sidebar("settings")

API_BASE = "http://localhost:8080"

st.markdown('<div class="page-title">⚙️ 系统配置</div>', unsafe_allow_html=True)
st.caption("LLM 大模型设置 · API 密钥管理 · 知识图谱数据库连接")

# ---- 辅助函数 ----
def check_be():
    try:
        return requests.get(f"{API_BASE}/api/health", timeout=2).status_code == 200
    except Exception:
        return False

def load_cfg():
    try:
        r = requests.get(f"{API_BASE}/api/settings/", timeout=5)
        return r.json() if r.status_code == 200 else {}
    except Exception:
        return {}

be_ok = check_be()
cfg = load_cfg()

if not be_ok:
    st.warning("后端服务未连接，配置修改需要后端支持。启动命令：`python -m src.main`")

# ========== 大模型 ==========
st.subheader("🤖 大语言模型")

c1, c2 = st.columns(2)
with c1:
    prov = st.selectbox("提供商", ["Claude (Anthropic)", "OpenAI (GPT)"],
                        index=0 if cfg.get("LLM_PROVIDER") == "claude" else 1,
                        help="Claude 法律领域准确度更高；OpenAI Embedding 用于向量检索")
with c2:
    temp = st.slider("随机度 Temperature", 0.0, 1.0, float(cfg.get("LLM_TEMPERATURE", 0.1)), 0.05,
                     help="合同审查建议 0.1，咨询建议 0.3")

c1, c2 = st.columns(2)
with c1:
    st.selectbox("Claude 模型", ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-5-20251001"],
                 key="cm", help="Sonnet 性价比最优，Opus 复杂推理最强")
with c2:
    st.selectbox("OpenAI 模型", ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
                 key="om", help="GPT-4o 综合能力最强")

st.number_input("最大输出令牌 Max Tokens", 256, 128000, int(cfg.get("LLM_MAX_TOKENS", 4096)), 256,
                key="mt", help="合同审查 4096，咨询 8192")

# ========== API Key ==========
st.markdown("---")
st.subheader("🔑 API 密钥")
st.caption("密钥加密存储在服务器 .env 文件中")

c1, c2 = st.columns(2)
with c1:
    st.text_input("Anthropic (Claude) Key", type="password", key="ak",
                  placeholder="sk-ant-…" if not cfg.get("ANTHROPIC_API_KEY") else cfg["ANTHROPIC_API_KEY"],
                  help="console.anthropic.com 申请")
with c2:
    st.text_input("OpenAI Key", type="password", key="ok",
                  placeholder="sk-…" if not cfg.get("OPENAI_API_KEY") else cfg["OPENAI_API_KEY"],
                  help="platform.openai.com 申请")

# ========== Neo4j ==========
st.markdown("---")
st.subheader("🗄️ 知识图谱数据库")

c1, c2, c3 = st.columns(3)
with c1:
    st.text_input("连接地址", value=cfg.get("NEO4J_URI", "bolt://localhost:7687"), key="nu",
                  help="Neo4j Desktop 默认 neo4j://127.0.0.1:7687")
with c2:
    st.text_input("用户名", value=cfg.get("NEO4J_USERNAME", "neo4j"), key="nun")
with c3:
    st.text_input("密码", type="password", value=cfg.get("NEO4J_PASSWORD", ""), key="npw")

# ========== 操作 ==========
st.markdown("---")
st.subheader("📋 操作")

bc1, bc2, bc3 = st.columns(3)
with bc1:
    if st.button("💾 保存配置", type="primary", use_container_width=True):
        if not be_ok:
            st.error("请先启动后端")
        else:
            payload = {
                "llm_provider": "claude" if "Claude" in prov else "openai",
                "claude_model": st.session_state.get("cm", ""),
                "openai_model": st.session_state.get("om", ""),
                "llm_temperature": temp,
                "llm_max_tokens": st.session_state.get("mt", 4096),
                "neo4j_uri": st.session_state.get("nu", ""),
                "neo4j_username": st.session_state.get("nun", ""),
                "neo4j_password": st.session_state.get("npw", ""),
            }
            if (ak_val := st.session_state.get("ak", "")):
                if ak_val != cfg.get("ANTHROPIC_API_KEY", ""):
                    payload["anthropic_api_key"] = ak_val
            if (ok_val := st.session_state.get("ok", "")):
                if ok_val != cfg.get("OPENAI_API_KEY", ""):
                    payload["openai_api_key"] = ok_val

            try:
                r = requests.post(f"{API_BASE}/api/settings/update", json=payload, timeout=10)
                d = r.json()
                if d.get("status") == "ok":
                    st.success("配置已保存")
                    st.info("提供商/模型变更需重启后端生效")
                else:
                    st.error(d.get("message", "保存失败"))
            except Exception as e:
                st.error(str(e))

with bc2:
    if st.button("🔍 测试大模型连接", use_container_width=True):
        if not be_ok:
            st.error("请先启动后端")
        else:
            with st.spinner("测试中…"):
                try:
                    r = requests.post(f"{API_BASE}/api/settings/test-connection", timeout=30)
                    d = r.json()
                    for k, v in d.get("results", {}).items():
                        label = {"embedding": "向量嵌入", "chat": "对话模型"}.get(k, k)
                        st.success(f"{label}：{v}") if "OK" in v else st.error(f"{label}：{v}")
                    if d.get("all_ok"):
                        st.balloons()
                except Exception as e:
                    st.error(str(e))

with bc3:
    if st.button("🗄️ 测试图谱连接", use_container_width=True):
        if not be_ok:
            st.error("请先启动后端")
        else:
            with st.spinner("测试中…"):
                try:
                    r = requests.post(f"{API_BASE}/api/settings/test-neo4j", timeout=10)
                    d = r.json()
                    st.success("连接正常") if d.get("status") == "ok" else st.warning(d.get("message", ""))
                except Exception as e:
                    st.error(str(e))

# ========== 当前配置 ==========
st.markdown("---")
st.subheader("📋 当前配置")

if cfg:
    display = {}
    for k, v in cfg.items():
        if "KEY" in k and v and len(str(v)) > 10:
            display[k] = str(v)[:8] + "****" + str(v)[-4:]
        else:
            display[k] = v
    st.json(display)
else:
    st.info("未加载到配置")
