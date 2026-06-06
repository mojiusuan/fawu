"""
判例匹配器 —— RAG + KG 联合检索 + LLM 精排
"""
import re
from src.knowledge_graph.query import kg_query


class CaseMatcher:
    """相似判例匹配器"""

    def match_by_case_type(self, case_type: str, facts: dict) -> list[dict]:
        """通过知识图谱按案由关联查找判例"""
        results = []
        try:
            # 查询 KG 中与案由相关的判例
            kg_results = kg_query.search_fulltext(case_type)
            for r in kg_results:
                if r.get("type") == "Case":
                    props = r.get("properties", {})
                    results.append({
                        "case_number": props.get("case_number", ""),
                        "title": props.get("title", ""),
                        "court": props.get("court", ""),
                        "case_date": props.get("case_date", ""),
                        "case_type": props.get("case_type", ""),
                        "key_points": props.get("key_points", []),
                        "verdict": props.get("verdict", ""),
                        "facts": props.get("facts", ""),
                        "score": r.get("score", 0),
                        "source": "KG",
                    })
        except Exception:
            pass
        return results

    def rerank_cases(self, query: str, rag_results: list[dict],
                     kg_results: list[dict]) -> list[dict]:
        """去重合并 + 排序，返回 Top 5 相似判例"""
        seen = set()
        merged = []

        # KG 结果优先
        for c in kg_results:
            cn = c.get("case_number", "")
            if cn and cn not in seen:
                seen.add(cn)
                merged.append(c)

        # RAG 结果补充
        for r in rag_results:
            title = r.get("article", "") or r.get("source", "")
            if title and title not in seen:
                seen.add(title)
                merged.append({
                    "case_number": r.get("article", ""),
                    "title": r.get("source", ""),
                    "court": "",
                    "case_date": r.get("date", ""),
                    "case_type": "",
                    "key_points": [],
                    "verdict": r.get("excerpt", ""),
                    "facts": r.get("full_content", ""),
                    "score": float(r.get("relevance_score", 0)) if r.get("relevance_score") else 0,
                    "similarity_reason": self._extract_similarity(query, r),
                    "source": "RAG",
                })

        # 按分数排序
        merged.sort(key=lambda x: x.get("score", 0), reverse=True)
        return merged[:5]

    def _extract_similarity(self, query: str, result: dict) -> str:
        """生成简单的相似度说明"""
        excerpt = result.get("excerpt", "") or result.get("full_content", "")
        keywords_in_query = re.findall(r'[一-龥]{2,}', query)
        matched = [kw for kw in keywords_in_query if kw in excerpt]
        if matched:
            return f"案件涉及{'、'.join(matched[:3])}等相似要素"
        return "案由和争议焦点相似"


case_matcher = CaseMatcher()
