"""
知识图谱构建器 —— 将抽取结果写入 Neo4j
"""
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable

from src.config import settings
from src.knowledge_graph.extractor import knowledge_extractor
from src.knowledge_graph.models import RelationType


class GraphBuilder:
    """Neo4j 图谱构建器"""

    def __init__(self):
        self.driver = None
        self._available = None

    def _ensure_connected(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            self.connect()
            self._available = True
        except Exception:
            self._available = False
        return self._available

    def connect(self):
        """连接 Neo4j"""
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
        )
        self.driver.verify_connectivity()
        self._create_indexes()
        self._available = True
        return self

    def close(self):
        if self.driver:
            try:
                self.driver.close()
            except Exception:
                pass

    def _create_indexes(self):
        """创建索引和约束"""
        with self.driver.session() as session:
            indexes = [
                "CREATE INDEX IF NOT EXISTS FOR (n:Law) ON (n.name)",
                "CREATE INDEX IF NOT EXISTS FOR (n:Article) ON (n.article_number)",
                "CREATE INDEX IF NOT EXISTS FOR (n:Case) ON (n.case_number)",
                "CREATE INDEX IF NOT EXISTS FOR (n:Contract) ON (n.title)",
                "CREATE INDEX IF NOT EXISTS FOR (n:Court) ON (n.name)",
                "CREATE INDEX IF NOT EXISTS FOR (n:LegalConcept) ON (n.name)",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Law) REQUIRE n.name IS UNIQUE",
                "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Case) REQUIRE n.case_number IS UNIQUE",
            ]
            for idx in indexes:
                try:
                    session.run(idx)
                except Exception as e:
                    print(f"索引创建跳过: {e}")

    def clear_all(self):
        """清空所有数据"""
        if not self._ensure_connected():
            return
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")

    def create_entity(self, entity_type: str, properties: dict) -> str:
        """创建单个实体"""
        if not self._ensure_connected():
            return ""

        key_map = {
            "Law": "name",
            "Article": "article_number",
            "Case": "case_number",
            "Contract": "title",
            "Clause": "clause_number",
            "RiskPoint": "risk_type",
            "LegalConcept": "name",
            "Court": "name",
        }
        key = key_map.get(entity_type, "name")
        key_value = properties.get(key, "")

        if not key_value:
            return ""

        cypher = f"""
        MERGE (n:{entity_type} {{{key}: $key_value}})
        SET n += $properties
        RETURN n.{key} as id
        """
        with self.driver.session() as session:
            result = session.run(cypher, key_value=key_value, properties=properties)
            record = result.single()
            return record["id"] if record else ""

    def create_relationship(
        self,
        source_type: str,
        source_name: str,
        relation: str,
        target_type: str,
        target_name: str,
    ):
        """创建关系"""
        if not self._ensure_connected():
            return

        source_key_map = {
            "Law": "name",
            "Article": "article_number",
            "Case": "case_number",
            "Contract": "title",
            "Clause": "clause_number",
            "RiskPoint": "risk_type",
            "LegalConcept": "name",
            "Court": "name",
        }
        target_key_map = dict(source_key_map)

        source_key = source_key_map.get(source_type, "name")
        target_key = target_key_map.get(target_type, "name")

        cypher = f"""
        MATCH (a:{source_type} {{{source_key}: $source_name}})
        MATCH (b:{target_type} {{{target_key}: $target_name}})
        MERGE (a)-[r:{relation}]->(b)
        RETURN type(r)
        """
        with self.driver.session() as session:
            session.run(cypher, source_name=source_name, target_name=target_name)

    async def build_from_extraction(self, extracted: dict) -> int:
        """从提取结果批量构建图谱"""
        if not self._ensure_connected():
            return 0

        count = 0
        entity_ids = {}
        for entity in extracted.get("entities", []):
            etype = entity["type"]
            props = entity["properties"]
            eid = self.create_entity(etype, props)
            if eid:
                key = f"{etype}:{eid}"
                entity_ids[key] = eid
                count += 1

        for rel in extracted.get("relationships", []):
            self.create_relationship(
                rel["source_type"],
                rel["source_name"],
                rel["relation"],
                rel["target_type"],
                rel["target_name"],
            )

        return count

    async def build_from_law_document(self, law_chunks: list[dict]) -> int:
        """从法律文档构建图谱"""
        extracted = await knowledge_extractor.extract_from_law_document(law_chunks)
        return await self.build_from_extraction(extracted)

    async def build_from_case_data(self, case_data: dict) -> int:
        """从判例数据构建图谱"""
        extracted = await knowledge_extractor.extract_from_case(case_data)
        return await self.build_from_extraction(extracted)

    async def build_from_contract(self, title: str, clauses: list[dict]) -> int:
        """从合同构建图谱"""
        extracted = await knowledge_extractor.extract_from_contract(title, clauses)
        return await self.build_from_extraction(extracted)

    def get_stats(self) -> dict:
        """获取图谱统计信息"""
        if not self._ensure_connected():
            return {"nodes": {}, "relationships": 0, "total_nodes": 0}

        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (n)
                RETURN labels(n)[0] as type, count(n) as count
                ORDER BY count DESC
                """
            )
            node_stats = {r["type"]: r["count"] for r in result}

            result = session.run("MATCH ()-[r]->() RETURN count(r) as count")
            rel_count = result.single()["count"]

            return {"nodes": node_stats, "relationships": rel_count, "total_nodes": sum(node_stats.values())}


# 全局单例
graph_builder = GraphBuilder()
