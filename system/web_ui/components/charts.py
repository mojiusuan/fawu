"""
图表组件（备用）
"""
import streamlit as st
import pandas as pd


def render_task_distribution(stats: dict):
    """渲染任务分布图"""
    if not stats:
        return
    tasks = stats.get("tasks", {})
    if tasks:
        df = pd.DataFrame({"任务类型": list(tasks.keys()), "次数": list(tasks.values())})
        st.bar_chart(df.set_index("任务类型"))


def render_model_usage(models: dict):
    """渲染模型使用统计"""
    if not models:
        return
    st.metric("使用模型", next(iter(models.keys()), "未知"))
