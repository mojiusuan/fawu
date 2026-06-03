"""
Agent 工具集 —— 供 LangGraph Agent 调用的工具函数
"""
from langchain_core.tools import tool

from src.rag_service.retriever import hybrid_retriever
from src.rag_service.parser import legal_parser


# ========== RAG 检索工具 ==========

@tool
def search_laws(query: str) -> str:
    """检索相关法律法规。输入法律问题描述，返回相关法条。"""
    import asyncio
    results = asyncio.run(hybrid_retriever.search_laws(query, top_k=5))
    if not results:
        return "未找到相关法律法规"
    parts = []
    for r in results:
        parts.append(f"【{r.get('source', '')}】{r.get('article', '')}: {r.get('excerpt', '')}")
    return "\n\n".join(parts)


@tool
def search_cases(query: str) -> str:
    """检索相关判例。输入关键词或法律问题，返回相关判例。"""
    import asyncio
    results = asyncio.run(hybrid_retriever.search_cases(query, top_k=5))
    if not results:
        return "未找到相关判例"
    parts = []
    for r in results:
        parts.append(f"【{r.get('source', '')}】{r.get('article', '')}: {r.get('excerpt', '')}")
    return "\n\n".join(parts)


@tool
def search_contracts(query: str) -> str:
    """检索相似合同条款。输入条款关键词，返回相似条款模板。"""
    import asyncio
    results = asyncio.run(hybrid_retriever.search(query, source_type="合同", top_k=5))
    if not results:
        return "未找到相关合同条款"
    parts = []
    for r in results:
        parts.append(f"{r.get('excerpt', '')}")
    return "\n\n".join(parts)


# ========== 文档处理工具 ==========

@tool
def parse_contract(file_path: str) -> str:
    """解析合同文档，提取条款。输入文件路径，返回条款列表。"""
    chunks = legal_parser.parse_to_documents(file_path)
    parts = []
    for c in chunks:
        title = c.get("title", c.get("article", ""))
        content = c.get("content", "")
        parts.append(f"## {title}\n{content[:300]}")
    return "\n\n".join(parts)


@tool
def extract_clauses(text: str) -> str:
    """从合同文本中提取条款。输入合同全文，返回条款编号和内容。"""
    import tempfile
    import os

    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8")
    try:
        tmp.write(text)
        tmp.close()
        chunks = legal_parser.parse_to_documents(tmp.name)
        parts = [f"{i+1}. {c.get('title', '')}: {c.get('content', '')[:200]}" for i, c in enumerate(chunks)]
        return "\n".join(parts)
    finally:
        os.unlink(tmp.name)


# ========== 知识图谱工具 ==========

@tool
def query_legal_graph(cypher: str) -> str:
    """查询法律知识图谱。输入 Cypher 查询语句，返回查询结果。"""
    from src.knowledge_graph.query import kg_query

    try:
        kg_query.connect()
        # 简化：做关键词搜索
        if "keyword" in cypher.lower() or "search" in cypher.lower():
            import re
            match = re.search(r"['\"](.+?)['\"]", cypher)
            if match:
                results = kg_query.search_fulltext(match.group(1))
                parts = [f"{r['type']}: {r['properties']}" for r in results[:10]]
                return "\n".join(parts)
        return "请使用 search_fulltext 进行关键词搜索"
    except Exception as e:
        return f"图谱查询失败: {e}"
    finally:
        kg_query.close()


# 工具注册表
ALL_TOOLS = [
    search_laws,
    search_cases,
    search_contracts,
    parse_contract,
    extract_clauses,
    query_legal_graph,
]
