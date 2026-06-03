"""
知识图谱 · Neo4j 可视化与查询
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
import pandas as pd
from style import inject_css
from components.nav import render_sidebar

inject_css()
render_sidebar("kg")

st.markdown('<div class="page-title">🔍 法律知识图谱</div>', unsafe_allow_html=True)
st.caption("基于 Neo4j 图数据库的法律实体关系网络 · 判例追溯 · 风险关联分析")

# 统计卡片
m1, m2, m3, m4 = st.columns(4)
m1.metric("实体类型", "8 种", help="Law / Article / Case / Contract / Clause / RiskPoint / LegalConcept / Court")
m2.metric("关系类型", "12 种", help="CONTAINS / CITES / HAS_RISK / BASED_ON / RELATED_TO 等")
m3.metric("已导入法条", "15 条", help="民法典合同编 12 条 + 公司法 3 条")
m4.metric("已导入判例", "2 份", help="最高法 + 上海一中院合同纠纷判例")

st.markdown("---")

# 查询 Tab
tab1, tab2, tab3 = st.tabs(["🔎 关键词检索", "📋 实体查询", "🔗 关系追溯"])

with tab1:
    kw = st.text_input("搜索关键词", "违约金")
    if st.button("搜索", key="kg_search"):
        st.markdown("#### 搜索结果")
        df = pd.DataFrame([
            {"类型": "法律概念", "名称": "违约金", "说明": "当事人约定一方违约时应当支付的金钱"},
            {"类型": "法律法规", "名称": "中华人民共和国民法典", "类别": "民事 · 现行有效"},
            {"类型": "法条", "编号": "第 585 条", "内容": "约定的违约金过分高于造成的损失的…可请求适当减少"},
            {"类型": "法条", "编号": "第 584 条", "内容": "损失赔偿额应相当于因违约所造成的损失…"},
            {"类型": "判例", "案号": "(2023) 最高法民终 123 号", "案件": "买卖合同纠纷 · 违约金调整"},
        ])
        st.dataframe(df, use_container_width=True, hide_index=True)
        st.caption("完整实时查询请使用 Neo4j Browser 运行 Cypher 语句")

with tab2:
    etype = st.selectbox("实体类型", ["法律法规", "法条", "判例", "合同", "法律概念", "风险点", "法院"])
    eid = st.text_input("实体名称", placeholder="如：民法典 / 第585条 / (2023)最高法民终123号")
    if st.button("查询实体", key="kg_entity"):
        st.info(f"查询「{etype}」: {eid}")
        st.markdown(f"""
        **推荐 Cypher 查询**（在 Neo4j Browser 中运行）：
        ```cypher
        MATCH (n)-[r]-(m)
        WHERE n.article_number = '{eid}' OR n.name = '{eid}' OR n.case_number = '{eid}'
        RETURN n, r, m
        ```
        """)

with tab3:
    st.markdown("#### 判例引用链追溯 · 示例")
    st.markdown("""
    ```
    中华人民共和国民法典
      └—— 合同编 · 违约责任
            └—— 第 585 条  违约金调整
                  ├—— 引用 ← (2023) 最高法民终 123 号  [买卖合同纠纷]
                  │              └—— 审理 ← 最高人民法院
                  ├—— 关联 → 违约金（法律概念）
                  └—— 引用 ← (2024) 沪 01 民初 1234 号  [建设工程合同]
                                 └—— 审理 ← 上海市第一中级人民法院
    ```
    """)

st.markdown("---")

# 本体结构
st.subheader("知识图谱本体模型")
onto = pd.DataFrame([
    {"实体": "法律法规 Law", "属性": "名称 · 类型 · 施行日期 · 状态", "关联关系": "包含(→)法条"},
    {"实体": "法条 Article", "属性": "编号 · 内容 · 所属法规 · 章节", "关联关系": "属于(→)法规 · 被引用(←)判例"},
    {"实体": "判例 Case", "属性": "案号 · 名称 · 法院 · 日期", "关联关系": "引用(→)法条 · 审理(→)法院"},
    {"实体": "合同 Contract", "属性": "名称 · 类型 · 甲方 · 乙方", "关联关系": "包含(→)条款"},
    {"实体": "条款 Clause", "属性": "编号 · 内容 · 风险等级", "关联关系": "存在风险(→)风险点"},
    {"实体": "风险点 RiskPoint", "属性": "类型 · 等级 · 描述 · 法律依据", "关联关系": "依据(→)法条"},
    {"实体": "法律概念 LegalConcept", "属性": "名称 · 定义", "关联关系": "关联(→)法条"},
    {"实体": "法院 Court", "属性": "名称 · 层级 · 管辖", "关联关系": "审理(←)案件"},
])
st.dataframe(onto, use_container_width=True, hide_index=True)

st.markdown("---")
st.markdown("""
#### 📖 操作指引
1. 打开 **Neo4j Desktop** → 选择数据库 → 点击 **Open Neo4j Browser**
2. 查看全部图谱：`MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50`
3. 查询特定法条引用链：`MATCH (a:Article {article_number: '第585条'})-[r]-(m) RETURN a, r, m`
""")
