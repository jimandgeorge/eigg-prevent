from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://eigg:eigg@localhost:5433/eigg_prevent"
    db_ssl: bool = False

    # App
    environment: str = "development"
    cors_origins: str = "http://localhost:3001"
    upload_dir: str = "uploads"   # where uploaded evidence files are stored

    # LLM
    llm_provider: str = "mock"

    anthropic_api_key: str | None = None

    azure_openai_key: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_deployment: str = "gpt-4o"

    aws_bedrock_region: str = "eu-west-2"
    aws_bedrock_model_id: str = "anthropic.claude-3-5-sonnet-20240620-v1:0"

    ollama_base_url: str | None = None
    ollama_model: str = "llama3.1:70b"


settings = Settings()
