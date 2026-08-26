"""
案情分析引擎 —— 结构化要素提取 + 法律适用 + 风险评估
"""
import json
import uuid
from datetime import datetime
from pathlib import Path

from src.config import settings
from src.utils.llm_client import llm_client
from src.rag_service.retriever import hybrid_retriever
from src.case_analysis_service.matcher import case_matcher

CASE_ANALYSIS_SYSTEM = """你是专业法律分析助手。基于用户提供的案情要素和检索到的法律依据，生成案情分析报告。

## 要求
1. 仅基于用户提供的案情事实进行分析，不编造未提及的事实
2. 法律依据必须引用真实的法条编号和内容
3. 相似判例必须从检索结果中选取，标注案号和法院
4. 风险评估需具体，列出有利因素和不利因素
5. 使用中文输出，语言专业但易于理解

## 安全护栏
- 不提供具体胜诉概率百分比
- 不确定的事项标注"建议进一步核实"
- 不替代律师出具正式法律意见"""


class CaseAnalyzer:
    """智能案情分析器"""

    def __init__(self):
        self._store_path = Path(settings.BASE_DIR) / "data" / "case_analyses.json"
        self._store_path.parent.mkdir(parents=True, exist_ok=True)

    def _load_case_types(self) -> dict:
        path = Path(settings.BASE_DIR) / "data" / "case_types.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    def _load_evidence_guides(self) -> dict:
        path = Path(settings.BASE_DIR) / "data" / "evidence_guides.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    def get_case_types(self) -> list[dict]:
        data = self._load_case_types()
        types = data.get("case_types", {})
        return [{"key": k, "name": v["name"], "description": v["description"],
                 "fields": v["fields"]} for k, v in types.items()]

    def get_case_type_fields(self, case_type: str) -> list[dict]:
        data = self._load_case_types()
        ct = data.get("case_types", {}).get(case_type)
        if ct:
            return ct.get("fields", [])
        return []

    async def analyze(self, case_type: str, structured_facts: dict,
                      case_id: str = "", user_id: str = "") -> dict:
        """执行案情分析，返回完整报告"""

        case_types = self._load_case_types()
        ct_info = case_types.get("case_types", {}).get(case_type, {})
        case_type_name = ct_info.get("name", case_type)

        # 构建检索查询
        query_parts = [case_type_name]
        for k, v in structured_facts.items():
            if v and isinstance(v, str) and len(v) > 2:
                query_parts.append(str(v))
        search_query = " ".join(query_parts[:6])

        # 1. 并行检索法律依据和判例
        law_results = await hybrid_retriever.search(search_query, source_type="法规", top_k=6)
        case_results = await hybrid_retriever.search(search_query, source_type="判例", top_k=10)

        # 2. 使用 KG 增强判例匹配
        kg_cases = case_matcher.match_by_case_type(case_type, structured_facts)
        similar_cases = case_matcher.rerank_cases(search_query, case_results, kg_cases)

        # 3. LLM 生成分析
        context = self._build_context(law_results, similar_cases, structured_facts, case_type_name)

        prompt = f"""案由: {case_type_name}

## 案情要素
{json.dumps(structured_facts, ensure_ascii=False, indent=2)}

## 检索结果
{context}

请生成案情分析报告，JSON 格式输出：
{{
  "summary": "案情摘要（200字以内）",
  "legal_basis": [{{"law": "法规名", "article": "条款编号", "content": "条文内容", "relevance": "与本案的关联说明"}}],
  "risk_assessment": {{
    "level": "高/中/低",
    "factors": ["有利/不利因素"],
    "suggestions": ["具体建议"]
  }}
}}"""

        answer, usage = await llm_client.generate(
            system_prompt=CASE_ANALYSIS_SYSTEM,
            user_prompt=prompt,
            temperature=0.3,
            max_tokens=2048,
        )

        # 解析 LLM 输出
        try:
            llm_result = json.loads(answer)
        except json.JSONDecodeError:
            # 尝试提取 JSON 块
            import re
            match = re.search(r'\{[\s\S]*\}', answer)
            llm_result = json.loads(match.group()) if match else {}

        # 4. 证据清单
        evidence_guides = self._load_evidence_guides()
        evidence_checklist = []
        guide = evidence_guides.get(case_type, evidence_guides.get("other", {}))
        for item in guide.get("required", []):
            evidence_checklist.append({"name": item["name"], "description": item["description"],
                                       "collected": False, "required": True, "tip": item.get("tip", "")})
        for item in guide.get("optional", []):
            evidence_checklist.append({"name": item["name"], "description": item["description"],
                                       "collected": False, "required": False, "tip": item.get("tip", "")})

        # 5. 时效检查
        limitation_info = self._check_limitation(case_type, structured_facts)

        # 6. 费用估算
        fee_info = self._estimate_fee(case_type, structured_facts)

        # 7. 组装报告
        analysis_id = str(uuid.uuid4())[:8]
        report = {
            "analysis_id": analysis_id,
            "case_id": case_id,
            "summary": llm_result.get("summary", ""),
            "legal_basis": llm_result.get("legal_basis", []),
            "similar_cases": similar_cases[:5],
            "risk_assessment": llm_result.get("risk_assessment", {}),
            "evidence_checklist": evidence_checklist,
            "limitation_check": limitation_info,
            "fee_estimate": fee_info,
            "disclaimer": "本分析报告由 AI 生成，仅供参考，不构成法律意见。具体案件请咨询执业律师。",
        }

        # 持久化
        self._save_analysis(analysis_id, case_type, case_type_name, report)

        return report

    def _build_context(self, law_results: list, case_results: list,
                       facts: dict, case_type_name: str) -> str:
        parts = []

        parts.append("### 适用法律依据")
        for r in law_results[:6]:
            source = r.get("source", "")
            article = r.get("article", "")
            excerpt = r.get("excerpt", "")[:300]
            parts.append(f"- **{source}** {article}: {excerpt}")

        parts.append("\n### 相关判例")
        for r in case_results[:5]:
            source = r.get("source", "")
            article = r.get("article", "")
            excerpt = r.get("excerpt", "")[:300]
            parts.append(f"- **{source}** {article}: {excerpt}")

        return "\n".join(parts)

    def _check_limitation(self, case_type: str, facts: dict) -> dict:
        """时效检查"""
        path = Path(settings.BASE_DIR) / "data" / "limitation_rules.json"
        if not path.exists():
            return {}
        rules = json.loads(path.read_text(encoding="utf-8"))

        ct_path = Path(settings.BASE_DIR) / "data" / "case_types.json"
        ct_data = json.loads(ct_path.read_text(encoding="utf-8")) if ct_path.exists() else {}
        ct_info = ct_data.get("case_types", {}).get(case_type, {})
        lim_type = ct_info.get("limitation_type", "general")

        lim_info = rules.get("types", {}).get(lim_type, rules.get("types", {}).get("general", {}))
        period_days = ct_info.get("limitation_period_days", lim_info.get("period_days", 1095))

        # 查找事件日期
        event_date = ""
        for key in ["incident_date", "loan_date", "employment_end", "purchase_date",
                    "transaction_date", "sign_date", "breach_date"]:
            val = facts.get(key, "")
            if val:
                event_date = str(val)
                break
        if not event_date:
            event_date = facts.get("event_date", datetime.now().strftime("%Y-%m-%d"))

        # 计算
        try:
            event_dt = datetime.strptime(event_date[:10], "%Y-%m-%d")
            deadline_dt = datetime(event_dt.year, event_dt.month, event_dt.day)
            from datetime import timedelta
            deadline_dt = deadline_dt + timedelta(days=period_days)
            remaining = (deadline_dt - datetime.now()).days
            is_expired = remaining < 0
        except Exception:
            deadline_dt = datetime.now()
            remaining = period_days
            is_expired = False

        status_text = "已过期" if is_expired else f"剩余 {remaining} 天"
        if is_expired:
            status_text += "（建议立即咨询律师，确认是否存在时效中断/中止情形）"

        return {
            "limitation_type": lim_type,
            "limitation_name": lim_info.get("name", ""),
            "period_text": lim_info.get("period_text", f"{period_days//365}年"),
            "period_days": period_days,
            "event_date": event_date[:10],
            "deadline_date": deadline_dt.strftime("%Y-%m-%d") if isinstance(deadline_dt, datetime) else "",
            "days_remaining": remaining,
            "is_expired": is_expired,
            "status_text": status_text,
            "legal_basis": lim_info.get("legal_basis", ""),
            "special_rules": lim_info.get("special_rules", []),
            "interruption_reasons": rules.get("interruption_reasons", []),
            "suspension_reasons": rules.get("suspension_reasons", []),
        }

    def _estimate_fee(self, case_type: str, facts: dict) -> dict:
        """估算诉讼费用"""
        path = Path(settings.BASE_DIR) / "data" / "fee_rules.json"
        if not path.exists():
            return {}

        rules = json.loads(path.read_text(encoding="utf-8"))

        amount = 0
        for key in ["claim_amount", "loan_amount", "contract_amount",
                    "amount_involved", "loss_amount", "purchase_amount"]:
            val = facts.get(key, 0)
            if val:
                try:
                    amount = float(val)
                    break
                except (ValueError, TypeError):
                    pass

        # 劳动争议按件收费
        if case_type == "labor":
            return {
                "case_type": "劳动争议",
                "fee_type": "按件收费",
                "court_fee": 10,
                "preservation_fee": 0,
                "total": 10,
                "note": "劳动争议案件每件10元",
            }

        if amount <= 0:
            return {}

        fee = self._calc_tiered(amount, rules.get("court_fee", {}).get("tiers", []))
        result = {
            "claim_amount": amount,
            "court_fee": round(fee, 2),
            "preservation_fee": 0,
            "total": round(fee, 2),
        }

        # 简易程序/调解 减半提示
        result["reduction_note"] = "（如适用简易程序或调解结案，可减半交纳）"

        return result

    def _calc_tiered(self, amount: float, tiers: list) -> float:
        """分段累计计算"""
        fee = 0
        prev_max = 0
        for tier in tiers:
            tier_max = tier.get("max")
            rate = tier.get("rate", 0)
            fixed = tier.get("fixed", 0)

            if tier_max is None:
                fee += (amount - prev_max) * rate
                break

            if amount <= tier_max:
                if fixed:
                    fee = fixed
                else:
                    fee += (amount - prev_max) * rate
                break
            else:
                if prev_max == 0 and fixed:
                    fee = fixed
                fee += (tier_max - prev_max) * rate
                prev_max = tier_max

        return fee

    def _save_analysis(self, analysis_id: str, case_type: str,
                       case_type_name: str, report: dict):
        try:
            existing = []
            if self._store_path.exists():
                existing = json.loads(self._store_path.read_text(encoding="utf-8"))
            record = {
                "analysis_id": analysis_id,
                "case_id": report.get("case_id", ""),
                "case_type": case_type,
                "case_type_name": case_type_name,
                "report": report,
                "generated_at": datetime.now().isoformat(),
            }
            existing.append(record)
            self._store_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"  [WARN] 分析记录保存失败: {e}")

    def get_analysis(self, analysis_id: str) -> dict | None:
        if not self._store_path.exists():
            return None
        try:
            data = json.loads(self._store_path.read_text(encoding="utf-8"))
            for r in data:
                if r.get("analysis_id") == analysis_id:
                    return r
        except Exception:
            pass
        return None

    def list_analyses(self, case_id: str = "") -> list[dict]:
        """列出所有历史分析，可按 case_id 过滤"""
        if not self._store_path.exists():
            return []
        try:
            data = json.loads(self._store_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        if case_id:
            data = [r for r in data if r.get("case_id") == case_id]
        data.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
        return data


case_analyzer = CaseAnalyzer()
