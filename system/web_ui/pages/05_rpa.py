"""
自动化工具 · 数据提取 & 批量处理
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import pandas as pd
import json
import requests
from style import inject_css
from components.nav import render_sidebar

inject_css()
render_sidebar("rpa")

API_BASE = "http://localhost:8080"

st.markdown('<div class="page-title">🤖 自动化工具</div>', unsafe_allow_html=True)
st.caption("AI 驱动的文档数据提取 · 批量关键条款挖掘 · 结构化输出")

tab1, tab2 = st.tabs(["📋 单文档数据提取", "📦 批量条款提取"])

with tab1:
    st.markdown("#### 从合同文档中提取结构化信息")
    st.caption("自动识别当事人、金额、期限、争议解决方式等关键字段")

    uploaded = st.file_uploader("上传合同文档", type=["pdf", "docx", "txt"], key="rpa_single")
    if uploaded:
        content = uploaded.read().decode("utf-8", errors="ignore")
        st.text_area("文档预览", content[:1200], height=180, disabled=True)

        if st.button("🚀 开始提取", type="primary"):
            with st.spinner("AI 正在分析文档…"):
                try:
                    resp = requests.post(f"{API_BASE}/api/rpa/extract", json={"content": content}, timeout=60)
                    if resp.status_code == 200:
                        result = resp.json()
                        st.success("提取成功")
                        st.json(result)
                        st.download_button("下载 JSON", json.dumps(result, ensure_ascii=False, indent=2),
                                          "extracted.json", "application/json")
                    else:
                        st.error(resp.text)
                except requests.ConnectionError:
                    st.warning("后端未连接，以下为模拟结果：")
                    st.json({
                        "contract_title": "货物买卖合同",
                        "party_a": "XX 贸易有限公司",
                        "party_b": "YY 科技有限公司",
                        "amount": "¥500,000.00",
                        "deadline": "2024-09-15",
                        "dispute_resolution": "甲方住所地人民法院诉讼",
                    })

with tab2:
    st.markdown("#### 批量提取多份合同的关键条款")
    st.caption("自动抓取违约责任、争议解决、保密条款、不可抗力等关键内容")

    files = st.file_uploader("上传合同文档（可多选）", type=["pdf", "docx", "txt"],
                             accept_multiple_files=True, key="rpa_batch")

    if files:
        st.markdown(f"已选择 **{len(files)}** 个文件")
        st.dataframe(pd.DataFrame({"文件名": [f.name for f in files]}), hide_index=True)

        if st.button("📦 批量提取", type="primary"):
            with st.spinner(f"处理 {len(files)} 个文件…"):
                results = []
                for f in files:
                    try:
                        content = f.read().decode("utf-8", errors="ignore")
                        resp = requests.post(f"{API_BASE}/api/rpa/batch-extract",
                                            json={"filename": f.name, "content": content}, timeout=60)
                        results.append(resp.json() if resp.status_code == 200 else {"文件": f.name, "状态": "失败"})
                    except Exception:
                        results.append({"文件": f.name, "状态": "失败"})

                st.success(f"处理完成：{len(results)} 个文件")
                st.dataframe(pd.DataFrame(results), use_container_width=True, hide_index=True)
                st.download_button("下载 CSV", pd.DataFrame(results).to_csv(index=False),
                                  "batch_result.csv", "text/csv")

st.markdown("---")
st.caption("提取结果由 AI 自动生成，重要数据请人工核实确认。")
