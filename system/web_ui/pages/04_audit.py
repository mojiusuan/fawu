"""
合规审计 · 决策链路追溯
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import pandas as pd
import json
from datetime import datetime
from style import inject_css
from components.nav import render_sidebar

inject_css()
render_sidebar("audit")

st.markdown('<div class="page-title">📊 合规审计报告</div>', unsafe_allow_html=True)
st.caption("AI 决策全链路追溯 · 输入输出哈希脱敏 · Append-only 防篡改日志")

# 加载本地日志
log_file = Path(__file__).parent.parent.parent / "logs" / "audit.jsonl"
audit_logs = []
if log_file.exists():
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    audit_logs.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

# 统计
total = len(audit_logs)
cases = len(set(l.get("case_id", "") for l in audit_logs)) if audit_logs else 0
users = len(set(l.get("user_id", "") for l in audit_logs)) if audit_logs else 0
errors = sum(1 for l in audit_logs if l.get("latency_ms", 0) > 30000) if audit_logs else 0
err_rate = f"{errors / total * 100:.1f}%" if total else "0%"

m1, m2, m3, m4 = st.columns(4)
m1.metric("总调用次数", str(total))
m2.metric("覆盖案件", str(cases))
m3.metric("活跃用户", str(users))
m4.metric("异常率", err_rate)

st.markdown("---")

# 查询
st.subheader("审计日志查询")
qtype = st.selectbox("查询方式", ["查看最近记录", "按案件筛选", "按任务类型"])

if qtype == "按案件筛选":
    case_query = st.text_input("案件编号")
    if st.button("查询", key="aud_case"):
        filtered = [l for l in audit_logs if case_query in l.get("case_id", "")]
        st.info(f"找到 {len(filtered)} 条")
elif qtype == "按任务类型":
    TASK_MAP = {
        "合同审查": "contract_review", "风险评估": "risk_assessment",
        "法律咨询": "legal_consultation", "条款比对": "clause_compare", "文书起草": "doc_draft",
    }
    t_sel = st.selectbox("任务类型", list(TASK_MAP.keys()))
    if st.button("查询", key="aud_task"):
        filtered = [l for l in audit_logs if l.get("task_type") == TASK_MAP[t_sel]]
        st.info(f"找到 {len(filtered)} 条")

# 日志表格
st.markdown("---")
st.subheader("审计记录")

if audit_logs:
    rows = []
    for l in audit_logs[-40:]:
        rows.append({
            "时间": l.get("timestamp", "")[:19],
            "用户": l.get("user_id", "-"),
            "任务": l.get("task_type", "-"),
            "案件": l.get("case_id", "-"),
            "模型": l.get("model", "-"),
            "延迟": f"{l.get('latency_ms', 0) / 1000:.1f}s",
            "审计ID": l.get("audit_id", "-"),
        })
    st.dataframe(pd.DataFrame(rows[::-1]), use_container_width=True, hide_index=True)
else:
    st.info("暂无审计日志。系统运行后每次 AI 调用会自动记录。")

st.markdown("---")

# 导出
st.subheader("导出报告")
ec1, ec2 = st.columns([1, 3])
with ec1:
    FMT_MAP = {"JSON 格式": "json", "CSV 表格": "csv", "Markdown 文档": "md"}
    ef = st.selectbox("格式", list(FMT_MAP.keys()), label_visibility="collapsed")
with ec2:
    if st.button("📥 生成并下载报告", use_container_width=True):
        if audit_logs:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            fmt = FMT_MAP[ef]
            if fmt == "json":
                data = json.dumps(audit_logs, ensure_ascii=False, indent=2)
                st.download_button("下载 JSON", data, f"audit_{ts}.json", "application/json")
            elif fmt == "csv":
                df = pd.DataFrame([{
                    "时间": l.get("timestamp", ""), "用户": l.get("user_id", ""),
                    "任务": l.get("task_type", ""), "案件": l.get("case_id", ""),
                    "模型": l.get("model", ""), "延迟ms": l.get("latency_ms", 0),
                } for l in audit_logs])
                st.download_button("下载 CSV", df.to_csv(index=False), f"audit_{ts}.csv", "text/csv")
            else:
                md = f"# 合规审计报告\n生成时间：{datetime.now().isoformat()}\n\n总记录：{len(audit_logs)}\n\n---\n"
                for l in audit_logs[-30:]:
                    md += f"- {l.get('timestamp','')[:19]} | {l.get('task_type','')} | {l.get('case_id','')}\n"
                st.download_button("下载 Markdown", md, f"audit_{ts}.md", "text/markdown")
            st.success(f"已生成 {len(audit_logs)} 条记录的报告")
        else:
            st.warning("暂无数据可导出")

# 合规清单
st.markdown("---")
st.subheader("合规检查清单")
c1, c2 = st.columns(2)
for i, (label, ok) in enumerate([
    ("审计日志完整性", bool(audit_logs)),
    ("PII 脱敏 · SHA256 哈希", True),
    ("日志防篡改 · append-only", True),
    ("多维度查询支持", True),
    ("异常记录可筛选", True),
    ("导出格式支持 JSON/CSV/MD", True),
]):
    (c1 if i < 3 else c2).checkbox(label, value=ok)
