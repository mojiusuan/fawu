---
name: legal-kg
description: 法律知识图谱 —— Neo4j 图数据库 schema 设计、Cypher 查询生成、法律实体关系抽取、知识图谱构建与查询、判例追溯路径。
---

# Legal KG — 法律知识图谱

## 触发条件
- 用户提到"知识图谱""Neo4j""图数据库""Cypher""实体抽取""关系追溯"
- 需要设计/修改图谱 schema
- 需要编写或调试 Cypher 查询
- 判例关联追溯、法条引用链查询

## 当前 Schema

| 实体 | 关系 |
|------|------|
| Law（法律） | CONTAINS → Article |
| Article（法条） | BELONGS_TO → Law, CITED_BY ← Case |
| Case（判例） | CITES → Article, HEARD_BY → Court |
| Contract（合同） | CONTAINS → Clause |
| Clause（条款） | HAS_RISK → RiskPoint |
| RiskPoint（风险点） | BASED_ON → Article |
| LegalConcept（法律概念） | RELATED_TO → Article |
| Court（法院） | 审理 ← Case |

## 开发模式
- **design_schema**: 设计/扩展 graph schema
- **generate_cypher**: 根据意图生成 Cypher 查询
- **build_index**: 管理 Neo4j 索引和约束
- **import_data**: 将法律数据导入图谱
- **check_graph**: 检查图谱状态和统计信息

## 代码集成
```python
from src.knowledge_graph.builder import graph_builder
from src.knowledge_graph.query import kg_query
from src.knowledge_graph.extractor import knowledge_extractor
```
