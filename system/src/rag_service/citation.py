"""
引用格式化 —— 法律引用规范
"""
from datetime import datetime


class CitationFormatter:
    """法律引用格式化器"""

    @staticmethod
    def format_law_citation(result: dict) -> str:
        """格式化法规引用"""
        law = result.get("law", result.get("source", ""))
        article = result.get("article", result.get("article_number", ""))
        content = result.get("content", "")
        date = result.get("effective_date", result.get("date", ""))
        source_name = result.get("source_name", "国家法律法规数据库")

        # 截取关键内容
        excerpt = content[:200] if len(content) > 200 else content

        return (
            f"**依据**: 《{law}》{article}\n" f"**原文**: {excerpt}\n" f"**来源**: {source_name}，{date} 施行"
        )

    @staticmethod
    def format_case_citation(result: dict) -> str:
        """格式化判例引用"""
        case_number = result.get("case_number", "")
        title = result.get("title", "")
        court = result.get("court", "")
        date = result.get("date", "")

        citation = f"**案号**: {case_number}\n" f"**案件名称**: {title}\n" f"**审理法院**: {court}"

        if date:
            citation += f"\n**裁判日期**: {date}"
            # 超过 5 年的判例提示
            try:
                case_year = int(date[:4])
                current_year = datetime.now().year
                if current_year - case_year > 5:
                    citation += "\n> ⚠️ 该判例超过 5 年，不排除已有新规或裁判观点变化"
            except (ValueError, IndexError):
                pass

        return citation

    @staticmethod
    def format_search_result(result: dict) -> dict:
        """格式化单条检索结果为标准化输出"""
        source = result.get("source", result.get("law", ""))
        article = result.get("article", "")
        content = result.get("content", "")
        date = result.get("effective_date", result.get("date", ""))
        score = result.get("score", result.get("relevance", ""))

        return {
            "source": source,
            "article": article,
            "excerpt": content[:200] if len(content) > 200 else content,
            "full_content": content,
            "date": date,
            "relevance": score if score else "中",
        }


citation_formatter = CitationFormatter()
