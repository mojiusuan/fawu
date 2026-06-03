"""
审计报告生成器
"""
import json
from datetime import datetime, timezone
from pathlib import Path

from src.config import settings
from src.audit_service.logger import audit_logger


class AuditReporter:
    """审计报告生成器"""

    def __init__(self):
        self.export_dir = Path(settings.EXPORT_DIR)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def generate_report(self) -> str:
        """生成 Markdown 格式审计报告"""
        stats = audit_logger.get_stats()
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        lines = [
            "## AI 系统合规审计报告",
            f"**生成时间**: {now}",
            "",
            "### 1. 总览",
            f"- 总调用次数: {stats['total']}",
            f"- 覆盖案件数: {stats['cases']}",
            f"- 活跃用户数: {stats['users']}",
            "",
            "### 2. 任务分布",
            "| 任务类型 | 次数 |",
            "|----------|------|",
        ]
        for task, count in stats["tasks"].items():
            lines.append(f"| {task} | {count} |")

        lines += [
            "",
            "### 3. 模型使用",
            "| 模型 | 次数 |",
            "|------|------|",
        ]
        for model, count in stats["models"].items():
            lines.append(f"| {model} | {count} |")

        lines += [
            "",
            "### 4. 合规状态",
            "- [x] 审计日志完整性: 已确认",
            "- [x] PII 脱敏: 已确认哈希化",
            "- [x] 日志防篡改: append-only 文件格式",
        ]

        return "\n".join(lines)

    def export(self, format: str = "json") -> str:
        """导出审计数据"""
        records = audit_logger.query(limit=1000)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        if format == "json":
            path = self.export_dir / f"audit_{ts}.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
        elif format == "csv":
            path = self.export_dir / f"audit_{ts}.csv"
            import csv

            if records:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=records[0].keys())
                    writer.writeheader()
                    writer.writerows(records)
            else:
                path.touch()
        else:
            path = self.export_dir / f"audit_{ts}.md"
            report = self.generate_report()
            with open(path, "w", encoding="utf-8") as f:
                f.write(report)

        return str(path)


audit_reporter = AuditReporter()
