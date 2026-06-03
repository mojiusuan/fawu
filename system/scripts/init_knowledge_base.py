"""
初始化知识库 —— 将示例数据导入向量索引和知识图谱
运行: python scripts/init_knowledge_base.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import json

from src.rag_service.parser import legal_parser
from src.rag_service.retriever import hybrid_retriever
from src.knowledge_graph.builder import graph_builder
from src.config import settings


async def init_knowledge_base():
    print("=" * 50)
    print("  智能法务系统 - 知识库初始化")
    print("=" * 50)

    knowledge_dir = Path(settings.KNOWLEDGE_BASE_DIR)
    all_chunks = []

    # 1. 导入法律法规
    print("\n[1/4] 导入法律法规...")
    laws_dir = knowledge_dir / "laws"
    if laws_dir.exists():
        for law_file in laws_dir.rglob("*.txt"):
            print(f"  - 处理: {law_file.name}")
            chunks = legal_parser.parse_to_documents(str(law_file))
            for c in chunks:
                c["source"] = c.get("law", law_file.stem)
            all_chunks.extend(chunks)
    print(f"  共导入 {len(all_chunks)} 条法律条款")

    # 2. 导入判例
    print("\n[2/4] 导入判例数据...")
    cases_dir = knowledge_dir / "cases"
    case_count = 0
    if cases_dir.exists():
        for case_file in cases_dir.rglob("*.json"):
            print(f"  - 处理: {case_file.name}")
            with open(case_file, "r", encoding="utf-8") as f:
                case_data = json.load(f)
            case_text = (
                f"案号: {case_data.get('case_number', '')}\n"
                f"案件名称: {case_data.get('title', '')}\n"
                f"审理法院: {case_data.get('court', '')}\n"
                f"裁判日期: {case_data.get('date', '')}\n"
                f"事实: {case_data.get('facts', '')}\n"
                f"判决: {case_data.get('verdict', '')}"
            )
            all_chunks.append(
                {
                    "source": case_data.get("case_number", case_file.stem),
                    "article": case_data.get("title", ""),
                    "title": case_data.get("title", ""),
                    "content": case_text,
                    "effective_date": case_data.get("date", ""),
                    "date": case_data.get("date", ""),
                    "chunk_id": f"case_{case_file.stem}",
                }
            )
            case_count += 1
    print(f"  共导入 {case_count} 份判例")

    # 3. 导入合同模板
    print("\n[3/4] 导入合同模板...")
    contracts_dir = knowledge_dir / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    data_contracts = Path(settings.BASE_DIR) / "data" / "contracts"
    if data_contracts.exists():
        for contract_file in data_contracts.glob("*.txt"):
            print(f"  - 处理: {contract_file.name}")
            chunks = legal_parser.parse_to_documents(str(contract_file))
            for c in chunks:
                c["source"] = contract_file.stem
            all_chunks.extend(chunks)

    print(f"  总计 {len(all_chunks)} 个文档块")

    # 4. 构建向量索引
    print("\n[4/4] 构建向量索引...")
    if all_chunks:
        try:
            count = await hybrid_retriever.index_documents(all_chunks)
            print(f"  共索引 {count} 个文档块")
            print("  - ChromaDB 语义检索索引: OK")
            print("  - Whoosh BM25 全文索引: OK")
        except Exception as e:
            print(f"  [WARN] 向量索引构建失败: {e}")
            print(f"  请确保已设置 OPENAI_API_KEY 环境变量")
    else:
        print("  [WARN] 无数据可索引")

    # 5. 构建知识图谱（可选，需 Neo4j 运行）
    print("\n[可选] 构建知识图谱到 Neo4j...")
    try:
        graph_builder.connect()
        graph_builder.clear_all()

        law_chunks = [c for c in all_chunks if not c.get("chunk_id", "").startswith("case_")]
        if law_chunks:
            await graph_builder.build_from_law_document(law_chunks)

        if cases_dir.exists():
            for case_file in cases_dir.rglob("*.json"):
                with open(case_file, "r", encoding="utf-8") as f:
                    case_data = json.load(f)
                await graph_builder.build_from_case_data(case_data)

        stats = graph_builder.get_stats()
        print(f"  图谱节点: {stats.get('total_nodes', 0)}")
        print(f"  图谱关系: {stats.get('relationships', 0)}")
        print(f"  节点分布: {stats.get('nodes', {})}")
    except Exception as e:
        print(f"  [INFO] Neo4j 未连接，图谱构建跳过: {e}")
        print(f"  [INFO] RAG 检索功能仍可正常使用（无需 Neo4j）")
    finally:
        graph_builder.close()

    print("\n" + "=" * 50)
    print("  初始化完成！")
    print(f"  RAG 检索: {'可用' if all_chunks else '待导入数据，请先设置 API Key'}")
    print(f"  知识图谱: {'可用' if graph_builder.driver else '需启动 Neo4j'}")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(init_knowledge_base())
