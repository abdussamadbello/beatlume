from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://beatlume:beatlume_dev@localhost:5432/beatlume"
    database_url_sync: str = "postgresql://beatlume:beatlume_dev@localhost:5432/beatlume"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # S3 / MinIO
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "beatlume"
    s3_secret_key: str = "beatlume_dev"
    s3_bucket_exports: str = "beatlume-exports"
    s3_bucket_assets: str = "beatlume-assets"
    s3_presigned_expiry: int = 3600

    # JWT
    jwt_secret_key: str = "dev-secret-change-in-production"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # OAuth
    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""

    # AI / LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ai_model_fast: str = "gpt-4o-mini"
    ai_model_standard: str = "gpt-4o"
    ai_model_powerful: str = "claude-sonnet-4-6"
    ai_model_scaffold: str = "claude-sonnet-4-6"

    # Observability
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    otel_service_name: str = "beatlume-api"
    log_level: str = "INFO"
    log_format: str = "json"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]

    # Environment
    environment: str = "development"

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
