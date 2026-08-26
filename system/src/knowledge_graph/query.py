"""
知识图谱查询 —— Cypher 查询封装
"""
from neo4j import GraphDatabase

from src.config import settings
from src.knowledge_graph.models import EntityDetail, RelationshipDetail, GraphQueryResult


class KGQuery:
    """知识图谱查询服务"""

    def __init__(self):
        self.driver = None
        self._available = None

    def _ensure_connected(self) -> bool:
        # 已连上则缓存，失败则每次重试（Neo4j 可能后启动）
        if self._available:
            return True
        try:
            self.connect()
            self._available = True
        except Exception:
            self._available = False
        return self._available

    @property
    def is_available(self) -> bool:
        return self._ensure_connected()

    def connect(self):
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
        )
        self.driver.verify_connectivity()
        self._ensure_fulltext_index()
        self._available = True
        return self

    def _ensure_fulltext_index(self):
        """确保全文索引存在，用于 search_fulltext"""
        cypher = """
        CREATE FULLTEXT INDEX entitySearch IF NOT EXISTS
        FOR (n:Law|Article|Case|Contract|Clause|RiskPoint|LegalConcept|Court)
        ON EACH [n.name, n.article_number, n.content, n.case_number,
                 n.title, n.facts, n.verdict, n.clause_number,
                 n.risk_type, n.description, n.definition]
        """
        try:
            with self.driver.session() as session:
                session.run(cypher)
        except Exception:
            pass

    def close(self):
        if self.driver:
            try:
                self.driver.close()
            except Exception:
                pass

    def _get_type_key_map(self):
        return {
            "Law": "name",
            "Article": "article_number",
            "Case": "case_number",
            "Contract": "title",
            "Clause": "clause_number",
            "RiskPoint": "risk_type",
            "LegalConcept": "name",
            "Court": "name",
        }

    def query_entity(self, entity_type: str, entity_id: str) -> EntityDetail | None:
        """查询单个实体"""
        if not self._ensure_connected():
            return None

        key = self._get_type_key_map().get(entity_type, "name")
        cypher = f"MATCH (n:{entity_type} {{{key}: $eid}}) RETURN n"
        with self.driver.session() as session:
            result = session.run(cypher, eid=entity_id)
            record = result.single()
            if record:
                node = record["n"]
                return EntityDetail(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    properties=dict(node.items()),
                )
        return None

    def query_relations(self, entity_type: str, entity_id: str) -> list[RelationshipDetail]:
        """查询实体的所有关系"""
        if not self._ensure_connected():
            return []

        key_map = self._get_type_key_map()
        key = key_map.get(entity_type, "name")

        cypher = f"""
        MATCH (n:{entity_type} {{{key}: $eid}})-[r]->(m)
        RETURN type(r) as rel, labels(m)[0] as target_type, m
        UNION
        MATCH (n:{entity_type} {{{key}: $eid}})<-[r]-(m)
        RETURN type(r) as rel, labels(m)[0] as target_type, m
        """
        with self.driver.session() as session:
            result = session.run(cypher, eid=entity_id)
            relationships = []
            for record in result:
                node = record["m"]
                ttype = record["target_type"]
                tkey = key_map.get(ttype, "name")
                target_id = node.get(tkey, "")
                relationships.append(
                    RelationshipDetail(
                        source_type=entity_type,
                        source_id=entity_id,
                        relation=record["rel"],
                        target_type=ttype,
                        target_id=target_id,
                    )
                )
            return relationships

    def search_law_articles(self, law_name: str) -> list[dict]:
        """查询某部法规下的所有法条"""
        if not self._ensure_connected():
            return []

        cypher = """
        MATCH (l:Law {name: $name})-[:CONTAINS]->(a:Article)
        RETURN a.article_number as article, a.content as content, a.chapter as chapter
        ORDER BY a.article_number
        """
        with self.driver.session() as session:
            result = session.run(cypher, name=law_name)
            return [dict(r) for r in result]

    def find_related_articles(self, concept: str) -> list[dict]:
        """查找与法律概念相关的法条"""
        if not self._ensure_connected():
            return []

        cypher = """
        MATCH (c:LegalConcept)-[:RELATED_TO]->(a:Article)
        WHERE c.name CONTAINS $concept
        RETURN c.name as concept, a.article_number as article, a.content as content
        """
        with self.driver.session() as session:
            result = session.run(cypher, concept=concept)
            return [dict(r) for r in result]

    def find_case_precedents(self, article_number: str) -> list[dict]:
        """查找引用某法条的判例"""
        if not self._ensure_connected():
            return []

        cypher = """
        MATCH (ca:Case)-[:CITES]->(a:Article {article_number: $article})
        RETURN ca.case_number as case_number, ca.title as title,
               ca.court as court, ca.case_date as date
        ORDER BY ca.case_date DESC
        """
        with self.driver.session() as session:
            result = session.run(cypher, article=article_number)
            return [dict(r) for r in result]

    def query_risks_for_contract(self, contract_title: str) -> list[dict]:
        """查询合同的所有风险点"""
        if not self._ensure_connected():
            return []

        cypher = """
        MATCH (ct:Contract {title: $title})-[:CONTAINS]->(cl:Clause)-[:HAS_RISK]->(rp:RiskPoint)
        RETURN cl.clause_number as clause, rp.risk_type as risk_type,
               rp.level as level, rp.description as description,
               rp.law_basis as law_basis, rp.suggestion as suggestion
        """
        with self.driver.session() as session:
            result = session.run(cypher, title=contract_title)
            return [dict(r) for r in result]

    def get_subgraph(self, entity_type: str, entity_id: str, depth: int = 2) -> GraphQueryResult:
        """获取子图"""
        if not self._ensure_connected():
            return GraphQueryResult(entities=[], relationships=[])

        key_map = self._get_type_key_map()
        key = key_map.get(entity_type, "name")

        cypher = f"""
        MATCH path = (n:{entity_type} {{{key}: $eid}})-[*1..{depth}]-(m)
        RETURN path
        """
        with self.driver.session() as session:
            result = session.run(cypher, eid=entity_id)
            entities = []
            relationships = []
            seen = set()

            for record in result:
                path = record["path"]
                for node in path.nodes:
                    nid = node.element_id
                    if nid not in seen:
                        seen.add(nid)
                        labels = list(node.labels)
                        etype = labels[0] if labels else "Unknown"
                        eid_val = node.get(key, "")
                        entities.append(
                            EntityDetail(entity_type=etype, entity_id=str(eid_val), properties=dict(node.items()))
                        )
                for rel in path.relationships:
                    rid = rel.element_id
                    if rid not in seen:
                        seen.add(rid)
                        relationships.append(
                            RelationshipDetail(
                                source_type="",
                                source_id="",
                                relation=rel.type,
                                target_type="",
                                target_id="",
                            )
                        )

            return GraphQueryResult(entities=entities, relationships=relationships)

    def search_fulltext(self, keyword: str) -> list[dict]:
        """关键词搜索实体"""
        if not self._ensure_connected():
            return []

        cypher = """
        CALL db.index.fulltext.queryNodes("entitySearch", $keyword)
        YIELD node, score
        RETURN labels(node)[0] as type, node, score
        ORDER BY score DESC
        LIMIT 20
        """
        with self.driver.session() as session:
            result = session.run(cypher, keyword=keyword)
            results = []
            for record in result:
                node = record["node"]
                results.append(
                    {
                        "type": record["type"],
                        "properties": dict(node.items()),
                        "score": record["score"],
                    }
                )
            return results


# 全局单例
kg_query = KGQuery()
