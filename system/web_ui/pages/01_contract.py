"""
合同管理 · 上传 / 审查 / 比对 / 生成
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import requests
from style import inject_css
from components.nav import render_sidebar

inject_css()
render_sidebar("contract")

API_BASE = "http://localhost:8080"

st.markdown('<div class="page-title">📄 合同管理</div>', unsafe_allow_html=True)
st.caption("合同上传解析 · AI 智能审查 · 条款差异比对 · 合同草案生成")

tab1, tab2, tab3, tab4 = st.tabs(["📤 上传合同", "🔍 智能审查", "⚖ 条款比对", "✏ 生成合同"])

# ========================================================================
# Tab 1: 上传
# ========================================================================
with tab1:
    with st.form("upload_form", clear_on_submit=False):
        c_left, c_right = st.columns([1, 1])
        with c_left:
            title = st.text_input("合同名称", placeholder="如：货物买卖合同")
            contract_type = st.selectbox("合同类型", ["买卖合同", "租赁合同", "服务合同", "劳动合同", "借款合同", "其他"])
        with c_right:
            party_a = st.text_input("甲方", placeholder="甲方公司全称")
            party_b = st.text_input("乙方", placeholder="乙方公司全称")

        content = st.text_area("合同正文", height=260, placeholder="请粘贴合同文本…\n\n第一条  合同标的\n第二条  价款与支付方式\n第三条  违约责任\n…")

        col_btn, _ = st.columns([1, 3])
        with col_btn:
            submitted = st.form_submit_button("📤 上传合同", type="primary", use_container_width=True)

    if submitted:
        if content.strip():
            try:
                resp = requests.post(f"{API_BASE}/api/contracts/upload", json={
                    "title": title, "contract_type": contract_type,
                    "content": content, "party_a": party_a, "party_b": party_b,
                })
                if resp.status_code == 200:
                    d = resp.json()
                    st.success(f"合同上传成功")
                    st.info(f"合同 ID：`{d['id']}`  （请复制保存，用于后续审查/比对）")
                    with st.expander("查看已解析的合同结构"):
                        st.json(d)
                else:
                    st.error(f"上传失败：{resp.text}")
            except requests.ConnectionError:
                st.warning("后端服务未启动，合同内容已暂存本地")
                st.code(content[:800])
        else:
            st.error("请输入合同正文内容")

# ========================================================================
# Tab 2: 审查
# ========================================================================
with tab2:
    cid = st.text_input("合同 ID", placeholder="输入合同 ID 开始审查", key="review_cid")
    if st.button("🔍 开始智能审查", type="primary", disabled=not cid.strip()):
        if cid.strip():
            with st.spinner("AI 正在审查合同…"):
                try:
                    resp = requests.post(f"{API_BASE}/api/contracts/review/{cid.strip()}", timeout=180)
                    if resp.status_code == 200:
                        d = resp.json()
                        # 统计卡片
                        m1, m2, m3, _ = st.columns([1, 1, 1, 3])
                        m1.metric("🔴 高风险", d.get("high_risks", 0))
                        m2.metric("🟡 中风险", d.get("medium_risks", 0))
                        m3.metric("🟢 低风险", d.get("low_risks", 0))
                        st.markdown("---")
                        st.caption(d.get("review_summary", ""))

                        for clause in d.get("clauses", []):
                            rl = clause.get("risk_level", "none")
                            icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(rl, "⚪")
                            with st.expander(f"{icon}  {clause.get('clause_number', '条款')}"):
                                if clause.get("content"):
                                    st.markdown(f"**原文**：{clause['content'][:400]}")
                                if clause.get("risk_analysis"):
                                    st.markdown(f"**风险分析**：{clause['risk_analysis']}")
                                if clause.get("law_basis"):
                                    st.markdown(f"**法律依据**：`{clause['law_basis']}`")
                                if clause.get("suggestion"):
                                    st.markdown(f"**修改建议**：{clause['suggestion']}")

                        if d.get("suggestions"):
                            st.markdown("---")
                            st.markdown("### 📝 综合建议")
                            st.info(d["suggestions"])
                    else:
                        st.error(f"审查失败：{resp.text}")
                except requests.ConnectionError:
                    st.error("无法连接后端服务，请先启动 `python -m src.main`")

# ========================================================================
# Tab 3: 比对
# ========================================================================
with tab3:
    ca, cb = st.columns(2)
    with ca:
        ca_id = st.text_input("合同 A ID（基准版本）", key="cmp_a")
    with cb:
        cb_id = st.text_input("合同 B ID（待审版本）", key="cmp_b")

    if st.button("⚖ 开始比对", type="primary", disabled=not (ca_id.strip() and cb_id.strip())):
        with st.spinner("AI 正在比对合同差异…"):
            try:
                resp = requests.post(f"{API_BASE}/api/contracts/compare", json={
                    "contract_a_id": ca_id.strip(), "contract_b_id": cb_id.strip(),
                }, timeout=180)
                if resp.status_code == 200:
                    d = resp.json()
                    s1, s2, s3, s4 = st.columns(4)
                    s1.metric("总条款", d.get("total_clauses", 0))
                    s2.metric("一致", d.get("identical", 0))
                    s3.metric("形式差异", d.get("formal_diff", 0))
                    s4.metric("实质性差异", d.get("substantive_diff", 0))

                    差异名 = {"identical": "一致", "formal": "形式差异", "substantive": "实质性差异"}
                    for diff in d.get("differences", []):
                        dt = diff.get("type", "")
                        if dt != "identical":
                            with st.expander(f"{diff.get('clause', '条款')} — {差异名.get(dt, dt)}"):
                                st.write(diff)
                else:
                    st.error(f"比对失败：{resp.text}")
            except requests.ConnectionError:
                st.error("无法连接后端服务")

# ========================================================================
# Tab 4: 生成
# ========================================================================
with tab4:
    with st.form("gen_form"):
        c1, c2 = st.columns(2)
        with c1:
            gen_type = st.selectbox("合同类型", ["买卖合同", "租赁合同", "服务合同", "劳动合同", "借款合同"])
            gen_pa = st.text_input("甲方信息", placeholder="XX 有限公司")
        with c2:
            gen_pb = st.text_input("乙方信息", placeholder="YY 科技有限公司")
        key_terms = st.text_area("关键条款要求（可选）", placeholder="如：分期付款、质保 12 个月、违约金不超过 20%")

        if st.form_submit_button("✏ AI 生成合同草案", type="primary"):
            with st.spinner("正在生成…"):
                try:
                    resp = requests.post(f"{API_BASE}/api/contracts/generate", json={
                        "contract_type": gen_type, "party_a": gen_pa,
                        "party_b": gen_pb, "key_terms": key_terms,
                    }, timeout=180)
                    if resp.status_code == 200:
                        d = resp.json()
                        st.success("合同草案已生成")
                        st.markdown(d["content"])
                        st.warning("⚠️ 本文件为 AI 生成草稿，需经执业律师审核确认后方可使用。")
                    else:
                        st.error(f"生成失败：{resp.text}")
                except requests.ConnectionError:
                    st.error("无法连接后端服务")
