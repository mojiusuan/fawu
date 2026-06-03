"""
合同审查能力评估脚本
运行: python tests/evaluate_contract_review.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import json
from datetime import datetime

from src.contract_service.agent import contract_agent
from src.contract_service.models import ClauseInfo


# ========== 测试用例集 ==========
TEST_CASES = [
    {
        "name": "违约金过高条款",
        "contract_type": "买卖合同",
        "clause_number": "第六条",
        "content": "若甲方逾期付款，每逾期一日，应按逾期金额的千分之五向乙方支付违约金。若乙方逾期交付，每逾期一日，应按合同总价款的千分之三向甲方支付违约金。",
        "expected_risk_level": "medium",
        "expected_law": "民法典第585条",
        "check_points": ["违约金", "过高", "千分之五", "调整"],
    },
    {
        "name": "管辖约定不对等",
        "contract_type": "买卖合同",
        "clause_number": "第七条",
        "content": "因本合同发生的争议，任何一方均可向甲方住所地人民法院提起诉讼。",
        "expected_risk_level": "low",
        "expected_law": "民事诉讼法",
        "check_points": ["管辖", "甲方", "不对等"],
    },
    {
        "name": "验收标准模糊",
        "contract_type": "买卖合同",
        "clause_number": "第四条",
        "content": "甲方应在收到货物后进行验收。验收不合格的，乙方应进行整改直至符合要求。",
        "expected_risk_level": "medium",
        "expected_law": "民法典",
        "check_points": ["验收", "标准", "模糊", "期限"],
    },
    {
        "name": "正常条款-合同生效",
        "contract_type": "买卖合同",
        "clause_number": "第八条",
        "content": "本合同自双方签字盖章之日起生效，一式两份，甲乙双方各执一份。",
        "expected_risk_level": "none",
        "expected_law": "",
        "check_points": [],
    },
    {
        "name": "租赁合同违约责任",
        "contract_type": "租赁合同",
        "clause_number": "第五条",
        "content": "若乙方逾期支付租金，每逾期一日，应按逾期金额的千分之五支付违约金。逾期超过30日，甲方有权解除合同。",
        "expected_risk_level": "medium",
        "expected_law": "民法典第585条",
        "check_points": ["违约金", "逾期", "千分之五"],
    },
]


async def evaluate_contract_review(test_cases: list[dict]) -> dict:
    """评估合同审查能力"""
    results = {
        "test_date": datetime.now().isoformat(),
        "total": len(test_cases),
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "details": [],
    }

    for tc in test_cases:
        print(f"\n测试: {tc['name']}...")
        clause = ClauseInfo(clause_number=tc["clause_number"], content=tc["content"])

        try:
            reviewed, summary = await contract_agent.review_contract(
                contract_id="eval_test",
                title=f"评估-{tc['contract_type']}",
                contract_type=tc["contract_type"],
                clauses=[clause],
            )

            if not reviewed:
                results["skipped"] += 1
                results["details"].append({"test_case": tc["name"], "passed": False, "error": "审查返回空"})
                continue

            r = reviewed[0]
            risk_level = r.risk_level.value if r.risk_level else "none"

            # 检查点
            checks = {
                "风险等级匹配": risk_level == tc["expected_risk_level"],
                "法律依据引用": bool(r.law_basis),
                "法律依据准确": any(law in (r.law_basis or "") for law in [tc["expected_law"]]),
                "有修改建议": bool(r.suggestion),
            }

            # 对于有风险的条款，关键检查点
            if tc["expected_risk_level"] != "none":
                checks["风险识别正确"] = risk_level != "none"

            # 对无风险条款
            if tc["expected_risk_level"] == "none":
                checks["正确识别为无风险"] = risk_level == "none"

            all_passed = all(checks.values())
            if all_passed:
                results["passed"] += 1
                print(f"  PASS")
            else:
                results["failed"] += 1
                print(f"  FAIL - 失败项: {[k for k, v in checks.items() if not v]}")

            results["details"].append(
                {
                    "test_case": tc["name"],
                    "passed": all_passed,
                    "checks": {k: ("PASS" if v else "FAIL") for k, v in checks.items()},
                    "ai_output": {
                        "risk_level": risk_level,
                        "risk_analysis": r.risk_analysis[:200] if r.risk_analysis else "",
                        "law_basis": r.law_basis,
                        "suggestion": r.suggestion[:200] if r.suggestion else "",
                    },
                }
            )

        except Exception as e:
            print(f"  ERROR: {e}")
            results["failed"] += 1
            results["details"].append({"test_case": tc["name"], "passed": False, "error": str(e)})

    # 计算指标
    if results["total"] > 0:
        results["accuracy"] = results["passed"] / results["total"]
        results["risk_detection_rate"] = sum(
            1
            for d in results["details"]
            if d.get("checks", {}).get("风险识别正确", "FAIL") == "PASS"
        ) / max(1, sum(1 for tc in test_cases if tc["expected_risk_level"] != "none"))

    print(f"\n{'='*50}")
    print(f"评估完成: {results['passed']}/{results['total']} 通过")
    print(f"准确率: {results.get('accuracy', 0):.1%}")
    print(f"{'='*50}")

    return results


def generate_report(results: dict) -> str:
    """生成 Markdown 评估报告"""
    lines = [
        "# AI 模型能力评估报告",
        f"**评估日期**: {results['test_date']}",
        f"**测试用例数**: {results['total']}",
        "",
        "## 总体评估",
        f"| 指标 | 得分 |",
        f"|------|------|",
        f"| 通过率 | {results.get('accuracy', 0):.1%} |",
        f"| 通过 | {results['passed']} |",
        f"| 失败 | {results['failed']} |",
        "",
        "## 各测试用例详情",
        "| 用例 | 结果 | 风险等级 | 法条引用 | 建议 |",
        "|------|------|----------|----------|------|",
    ]

    for d in results["details"]:
        checks = d.get("checks", {})
        ai = d.get("ai_output", {})
        status = "✅" if d["passed"] else "❌"
        lines.append(
            f"| {d['test_case']} | {status} | "
            f"{ai.get('risk_level', '-')} | "
            f"{checks.get('法律依据准确', '-')} | "
            f"{checks.get('有修改建议', '-')} |"
        )

    lines += [
        "",
        "## 失败案例分析",
    ]
    for d in results["details"]:
        if not d["passed"]:
            lines.append(f"### {d['test_case']}")
            lines.append(f"```json\n{json.dumps(d.get('ai_output', {}), ensure_ascii=False, indent=2)}\n```")
            if d.get("error"):
                lines.append(f"错误: {d['error']}")

    report = "\n".join(lines)

    # 保存报告
    report_path = Path("exports") / f"eval_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    report_path.parent.mkdir(exist_ok=True)
    report_path.write_text(report, encoding="utf-8")
    print(f"\n评估报告已保存: {report_path}")

    return report


async def main():
    results = await evaluate_contract_review(TEST_CASES)
    generate_report(results)


if __name__ == "__main__":
    asyncio.run(main())
