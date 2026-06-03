"""
配置管理 API —— 前端可修改系统配置
"""
import os
import re
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel
from dotenv import load_dotenv

router = APIRouter(prefix="/api/settings", tags=["系统配置"])

ENV_PATH = Path(__file__).parent.parent / ".env"


class SettingsUpdate(BaseModel):
    llm_provider: str | None = None       # claude / openai / deepseek
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    deepseek_api_key: str | None = None
    claude_model: str | None = None
    openai_model: str | None = None
    deepseek_model: str | None = None
    embedding_model: str | None = None
    llm_temperature: float | None = None
    llm_max_tokens: int | None = None
    neo4j_uri: str | None = None
    neo4j_username: str | None = None
    neo4j_password: str | None = None


def read_env_file() -> dict:
    """读取 .env 文件中的所有配置"""
    if not ENV_PATH.exists():
        return {}
    config = {}
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            # 去除引号
            value = value.strip().strip('"').strip("'")
            config[key.strip()] = value
    return config


def write_env_file(config: dict):
    """写入 .env 文件"""
    if not ENV_PATH.exists():
        # 从 .env.example 复制模板
        example_path = ENV_PATH.with_suffix(".example")
        if example_path.exists():
            import shutil
            shutil.copy(example_path, ENV_PATH)

    if not ENV_PATH.exists():
        ENV_PATH.touch()

    lines = ENV_PATH.read_text(encoding="utf-8").split("\n")
    updated_keys = set()

    new_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            new_lines.append(line)
            continue
        key = stripped.split("=")[0].strip()
        if key in config:
            # 处理含有 # 注释的行
            comment = ""
            value_part = line.split("=", 1)[1]
            if "#" in value_part and not value_part.strip().startswith('"'):
                comment_idx = value_part.index("#")
                comment = value_part[comment_idx:]
            new_lines.append(f"{key}={config[key]}{comment}")
            updated_keys.add(key)
        else:
            new_lines.append(line)

    # 追加未在文件中的新 key
    for key, value in config.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}")

    ENV_PATH.write_text("\n".join(new_lines), encoding="utf-8")

    # 也更新当前进程的环境变量
    for key, value in config.items():
        os.environ[key] = str(value)


@router.get("/")
async def get_settings():
    """获取当前配置（脱敏显示 API Key）"""
    config = read_env_file()
    # 脱敏
    for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"]:
        if key in config and config[key]:
            val = config[key]
            if len(val) > 12:
                config[key] = val[:8] + "****" + val[-4:]
            elif len(val) > 4:
                config[key] = val[:4] + "****"
    return config


@router.post("/update")
async def update_settings(update: SettingsUpdate):
    """更新系统配置"""
    field_map = {
        "llm_provider": "LLM_PROVIDER",
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "openai_api_key": "OPENAI_API_KEY",
        "deepseek_api_key": "DEEPSEEK_API_KEY",
        "claude_model": "CLAUDE_MODEL",
        "openai_model": "OPENAI_MODEL",
        "deepseek_model": "DEEPSEEK_MODEL",
        "embedding_model": "EMBEDDING_MODEL",
        "llm_temperature": "LLM_TEMPERATURE",
        "llm_max_tokens": "LLM_MAX_TOKENS",
        "neo4j_uri": "NEO4J_URI",
        "neo4j_username": "NEO4J_USERNAME",
        "neo4j_password": "NEO4J_PASSWORD",
    }

    config = read_env_file()
    updated = {}

    for field_name, env_key in field_map.items():
        value = getattr(update, field_name, None)
        if value is not None:
            config[env_key] = str(value)
            updated[field_name] = str(value)

    write_env_file(config)

    # 尝试重新加载设置
    try:
        from src.config import settings
        load_dotenv(ENV_PATH, override=True)
        # 重新创建 settings 实例的属性
        for key, value in config.items():
            setattr(settings, key, value)
    except Exception:
        pass

    return {
        "status": "ok",
        "message": f"已更新 {len(updated)} 项配置",
        "updated": list(updated.keys()),
        "note": "部分配置需重启后端服务后生效",
    }


@router.post("/test-connection")
async def test_llm_connection():
    """测试 LLM API 连接是否正常"""
    from src.utils.llm_client import LLMClient
    from src.config import settings

    results = {}
    client = LLMClient()

    # 测试 Embedding
    emb_label = "本地 BGE 中文模型" if settings.EMBEDDING_PROVIDER == "local" else "OpenAI"
    try:
        vec = await client.embed_query("测试连接")
        if vec and len(vec) > 0:
            results["embedding"] = f"OK ({emb_label} · 维度={len(vec)})"
        else:
            results["embedding"] = "FAIL: 返回空向量"
    except Exception as e:
        results["embedding"] = f"FAIL ({emb_label}): {str(e)[:80]}"

    # 测试 Chat（用当前 provider）
    provider_label = {"claude": "Claude", "openai": "OpenAI", "deepseek": "DeepSeek"}.get(
        settings.LLM_PROVIDER, settings.LLM_PROVIDER
    )
    model_name = settings.llm_model
    is_reasoner = settings.LLM_PROVIDER == "deepseek" and "reasoner" in model_name
    try:
        resp, usage = await client.generate(
            system_prompt="" if is_reasoner else "回复 OK。",
            user_prompt="OK",
            temperature=None,   # reasoner 自动跳过
            max_tokens=None,
        )
        if resp:
            results["chat"] = f"OK ({provider_label} · {model_name} · {usage.get('latency_ms', 0)}ms)"
        else:
            results["chat"] = "FAIL: 空响应"
    except Exception as e:
        results["chat"] = f"FAIL ({provider_label} · {model_name}): {str(e)[:120]}"

    return {"results": results, "all_ok": all("OK" in v for v in results.values())}


@router.post("/test-neo4j")
async def test_neo4j_connection():
    """测试 Neo4j 连接"""
    from neo4j import GraphDatabase

    config = read_env_file()
    uri = config.get("NEO4J_URI", "bolt://localhost:7687")
    user = config.get("NEO4J_USERNAME", "neo4j")
    password = config.get("NEO4J_PASSWORD", "legaladmin123")

    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        with driver.session() as session:
            result = session.run("RETURN 1 as n")
            record = result.single()
            if record and record["n"] == 1:
                return {"status": "ok", "message": "Neo4j 连接正常"}
        driver.close()
    except Exception as e:
        return {"status": "error", "message": f"Neo4j 连接失败: {str(e)[:120]}"}

    return {"status": "error", "message": "Neo4j 连接异常"}
