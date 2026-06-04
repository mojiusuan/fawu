"""
智能法务系统 - 全局配置管理
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)


class Settings:
    """全局配置"""

    # --- 应用 ---
    APP_NAME: str = os.getenv("APP_NAME", "智能法务系统")
    APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # --- LLM ---
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "claude")  # claude / openai / deepseek
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "local")  # local / openai
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "bge-large-zh-v1.5")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))

    # --- Neo4j ---
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USERNAME: str = os.getenv("NEO4J_USERNAME", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "legaladmin123")

    # --- ChromaDB ---
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")

    # --- 路径 ---
    BASE_DIR: Path = Path(__file__).parent.parent
    AUDIT_LOG_DIR: str = os.getenv("AUDIT_LOG_DIR", str(BASE_DIR / "logs"))
    EXPORT_DIR: str = os.getenv("EXPORT_DIR", str(BASE_DIR / "exports"))
    KNOWLEDGE_BASE_DIR: str = os.getenv("KNOWLEDGE_BASE_DIR", str(BASE_DIR / "knowledge"))
    PROMPTS_DIR: str = str(BASE_DIR / "prompts")

    # --- 模型下载镜像 ---
    HF_ENDPOINT: str = os.getenv("HF_ENDPOINT", "https://huggingface.co")

    # --- 认证 ---
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "legal-system-jwt-secret-change-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # --- 日志 ---
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    @property
    def llm_model(self) -> str:
        """获取当前使用的 LLM 模型名"""
        if self.LLM_PROVIDER == "claude":
            return self.CLAUDE_MODEL
        elif self.LLM_PROVIDER == "deepseek":
            return self.DEEPSEEK_MODEL
        return self.OPENAI_MODEL

    def ensure_directories(self):
        """确保必要的目录存在"""
        for d in [self.AUDIT_LOG_DIR, self.EXPORT_DIR, self.KNOWLEDGE_BASE_DIR]:
            Path(d).mkdir(parents=True, exist_ok=True)
        (Path(self.BASE_DIR) / "data").mkdir(parents=True, exist_ok=True)


settings = Settings()
