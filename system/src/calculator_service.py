"""
计算器服务 —— 诉讼费 / 赔偿金 / 诉讼时效
"""
import json
from datetime import datetime, timedelta
from pathlib import Path
from src.config import settings


class CalculatorService:

    def __init__(self):
        self._data_dir = Path(settings.BASE_DIR) / "data"

    def _load_json(self, filename: str) -> dict:
        path = self._data_dir / filename
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    # === 诉讼费计算 ===

    def calc_court_fee(self, case_type: str, claim_amount: float,
                       include_preservation: bool = False,
                       include_execution: bool = False,
                       preservation_amount: float = 0) -> dict:
        """计算案件受理费（含保全费、执行费）"""
        rules = self._load_json("fee_rules.json")

        # 非财产案件
        if case_type == "divorce":
            base_fee = 50
            if claim_amount > 200000:
                extra = (claim_amount - 200000) * 0.005
                base_fee = min(300, 50 + extra)
            return self._build_fee_result(claim_amount, base_fee, 0, 0,
                                          f"离婚案件：50-300元（涉及财产分割超20万部分加收0.5%）")
        if case_type == "labor":
            return self._build_fee_result(claim_amount, 10, 0, 0,
                                          "劳动争议案件：每件10元")

        # 财产案件分段累计
        court_fee_rules = rules.get("court_fee", {})
        tiers = court_fee_rules.get("tiers", [])
        court_fee, court_steps = self._calc_tiered_with_steps(claim_amount, tiers)

        # 保全费
        preservation_fee = 0
        pres_steps = []
        if include_preservation and preservation_amount > 0:
            pres_rules = rules.get("preservation_fee", {})
            pres_tiers = pres_rules.get("tiers", [])
            preservation_fee, pres_steps = self._calc_tiered_with_steps(preservation_amount, pres_tiers)
            max_fee = pres_rules.get("max_fee", 5000)
            if preservation_fee > max_fee:
                pres_steps.append(f"保全费上限 {max_fee} 元，实际按 {max_fee} 元收取")
                preservation_fee = max_fee

        # 执行费
        execution_fee = 0
        exec_steps = []
        if include_execution:
            exec_rules = rules.get("execution_fee", {})
            exec_tiers = exec_rules.get("tiers", [])
            execution_fee, exec_steps = self._calc_tiered_with_steps(claim_amount, exec_tiers)

        total = court_fee + preservation_fee + execution_fee

        # 构建计算步骤说明
        calc_steps = [{"title": "案件受理费计算", "steps": court_steps, "result": round(court_fee, 2)}]
        if pres_steps:
            calc_steps.append({"title": "申请保全费计算", "steps": pres_steps, "result": round(preservation_fee, 2)})
        if exec_steps:
            calc_steps.append({"title": "申请执行费计算", "steps": exec_steps, "result": round(execution_fee, 2)})

        reduction = court_fee_rules.get("reduction_policy", {}).get("summary", "")
        breakdown = [
            {"item": "案件受理费", "amount": round(court_fee, 2),
             "basis": "《诉讼费用交纳办法》第十三条"},
        ]
        if preservation_fee > 0:
            breakdown.append({"item": "申请保全费", "amount": round(preservation_fee, 2),
                              "basis": "《诉讼费用交纳办法》第十四条",
                              "note": f"保全金额 {preservation_amount:,.0f} 元，保全费上限 5,000 元"})
        if execution_fee > 0:
            breakdown.append({"item": "申请执行费", "amount": round(execution_fee, 2),
                              "basis": "《诉讼费用交纳办法》第十四条",
                              "note": "由被执行人承担，申请人无需预交"})

        return {
            "claim_amount": claim_amount,
            "court_fee": round(court_fee, 2),
            "preservation_fee": round(preservation_fee, 2),
            "execution_fee": round(execution_fee, 2),
            "total": round(total, 2),
            "breakdown": breakdown,
            "calc_steps": calc_steps,
            "reduction_note": reduction,
            "note": "此为估算金额，实际费用以法院通知为准",
        }

    def _calc_tiered(self, amount: float, tiers: list) -> float:
        """分段累计计算"""
        if amount <= 0:
            return 0
        fee = 0
        prev = 0
        for t in tiers:
            hi = t.get("max")
            rate = t.get("rate", 0)
            fixed = t.get("fixed")
            if hi is not None and amount <= hi:
                if fixed is not None:
                    return float(fixed)
                fee += (amount - prev) * rate
                return fee
            else:
                if fixed is not None:
                    fee = float(fixed)
                elif hi is not None:
                    fee += (hi - prev) * rate
                else:
                    fee += (amount - prev) * rate
                    return fee
                prev = hi if hi is not None else prev
        return fee

    def _calc_tiered_with_steps(self, amount: float, tiers: list) -> tuple[float, list[str]]:
        """分段累计计算（含逐步解释）"""
        if amount <= 0:
            return 0, ["标的额为0，无需缴费"]
        fee = 0
        prev = 0
        steps = []
        for t in tiers:
            hi = t.get("max")
            rate = t.get("rate", 0)
            fixed = t.get("fixed")
            desc = t.get("description", "")

            if hi is not None and amount <= hi:
                if fixed is not None:
                    steps.append(f"标的额 {amount:,.0f} 元 ≤ {hi:,} 元，{desc}，固定收费 {fixed} 元")
                    return float(fixed), steps
                part = amount - prev
                add = part * rate
                steps.append(f"超过 {prev:,} 元至 {amount:,.0f} 元部分（{desc}）：{part:,.0f} × {rate*100:.1f}% = {add:,.2f} 元")
                fee += add
                steps.append(f"合计：{fee:,.2f} 元")
                return fee, steps
            else:
                if fixed is not None:
                    fee = float(fixed)
                    steps.append(f"不超过 {hi:,} 元部分（{desc}）：固定收费 {fixed} 元")
                elif hi is not None:
                    part = hi - prev
                    add = part * rate
                    steps.append(f"超过 {prev:,} 元至 {hi:,} 元部分（{desc}）：{part:,.0f} × {rate*100:.1f}% = {add:,.2f} 元")
                    fee += add
                else:
                    part = amount - prev
                    add = part * rate
                    steps.append(f"超过 {prev:,} 元部分（{desc}）：{part:,.0f} × {rate*100:.1f}% = {add:,.2f} 元")
                    fee += add
                    steps.append(f"合计：{fee:,.2f} 元")
                    return fee, steps
                prev = hi if hi is not None else prev
        steps.append(f"合计：{fee:,.2f} 元")
        return fee, steps

    def _build_fee_result(self, claim_amount, court_fee, preservation_fee,
                          execution_fee, note) -> dict:
        return {
            "claim_amount": claim_amount,
            "court_fee": round(court_fee, 2),
            "preservation_fee": round(preservation_fee, 2),
            "execution_fee": round(execution_fee, 2),
            "total": round(court_fee + preservation_fee + execution_fee, 2),
            "breakdown": [{"item": "案件受理费", "amount": round(court_fee, 2),
                           "basis": "《诉讼费用交纳办法》"}],
            "reduction_note": note,
            "note": "此为估算金额，实际费用以法院通知为准",
        }

    # === 赔偿计算 ===

    def calc_compensation(self, scenario: str, params: dict) -> dict:
        """计算赔偿/补偿金额"""
        rules = self._load_json("compensation_rules.json")
        scenario_rules = rules.get("scenarios", {}).get(scenario)
        if not scenario_rules:
            return {"error": f"未知场景: {scenario}"}

        items = []
        for item_def in scenario_rules.get("items", []):
            amount = self._eval_formula(item_def.get("formula", ""), params)
            # 处理最低金额约束
            min_val = item_def.get("min", 0)
            if min_val and amount < min_val:
                amount = min_val
            items.append({
                "name": item_def["name"],
                "amount": round(amount, 2),
                "formula": item_def.get("formula", ""),
                "description": item_def.get("description", ""),
            })

        total = sum(it["amount"] for it in items)
        return {
            "scenario": scenario,
            "scenario_name": scenario_rules.get("name", ""),
            "items": items,
            "total_min": round(total * 0.8, 2),
            "total_max": round(total, 2),
            "legal_basis": scenario_rules.get("legal_basis", ""),
            "notes": scenario_rules.get("notes", []),
        }

    def _eval_formula(self, formula: str, params: dict) -> float:
        """安全公式求值：仅允许数字和四则运算"""
        if not formula:
            return 0
        # 所有已知变量名
        known_vars = [
            "monthly_salary", "unpaid_months", "unpaid_total", "years_of_service",
            "purchase_amount", "loan_amount", "claim_amount", "contract_amount",
            "medical_cost", "daily_income", "lost_days",
            "daily_care", "care_days", "transport_cost",
            "food_allowance", "hospital_days", "nutrition_cost",
            "annual_disability_income", "disability_ratio", "mental_damage",
        ]
        expr = formula
        for var in known_vars:
            if var in expr:
                expr = expr.replace(var, str(params.get(var, 0)))
        for key, val in params.items():
            if key not in known_vars and key in expr:
                expr = expr.replace(key, str(val))
        # 安全检查：只允许数字、空格、小数点、运算符
        import re
        if not re.match(r'^[\d\s\.\+\-\*\/\(\)]+$', expr):
            return 0
        try:
            return float(eval(expr))
        except Exception:
            return 0

    # === 诉讼时效 ===

    def check_limitation(self, case_type: str, event_date: str) -> dict:
        """检查诉讼时效"""
        rules = self._load_json("limitation_rules.json")
        case_types = self._load_json("case_types.json")

        ct_info = case_types.get("case_types", {}).get(case_type, {})
        lim_type = ct_info.get("limitation_type", "general")
        period_days = ct_info.get("limitation_period_days",
                                  rules.get("types", {}).get(lim_type, {}).get("period_days", 1095))

        lim_info = rules.get("types", {}).get(lim_type, rules.get("types", {}).get("general", {}))

        try:
            event_dt = datetime.strptime(event_date[:10], "%Y-%m-%d")
            deadline_dt = event_dt + timedelta(days=period_days)
            remaining = (deadline_dt - datetime.now()).days
            is_expired = remaining < 0
        except Exception:
            return {"error": "日期格式错误，请使用 YYYY-MM-DD"}

        if is_expired:
            status_text = f"⚠️ 已超过{lim_info.get('period_text', '')}时效（超期{abs(remaining)}天）"
            status_text += "。请立即咨询律师，确认是否存在时效中断/中止情形。"
        elif remaining <= 30:
            status_text = f"⏰ 即将到期！剩余仅 {remaining} 天，请尽快采取法律行动。"
        elif remaining <= 90:
            status_text = f"⚠️ 时效内，但剩余不足3个月（{remaining}天），建议尽快启动维权程序。"
        else:
            status_text = f"✅ 时效内，剩余 {remaining} 天。"

        return {
            "limitation_type": lim_type,
            "limitation_name": lim_info.get("name", ""),
            "period_text": lim_info.get("period_text", f"{period_days // 365}年"),
            "period_days": period_days,
            "event_date": event_date[:10],
            "deadline_date": deadline_dt.strftime("%Y-%m-%d"),
            "days_remaining": remaining,
            "is_expired": is_expired,
            "status_text": status_text,
            "legal_basis": lim_info.get("legal_basis", ""),
            "start_from": lim_info.get("start_from", ""),
            "special_rules": lim_info.get("special_rules", []),
            "interruption_reasons": rules.get("interruption_reasons", []),
            "suspension_reasons": rules.get("suspension_reasons", []),
        }


calculator_service = CalculatorService()
