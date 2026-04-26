from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database — required
    database_url: str = "postgresql+asyncpg://beatlume:beatlume_dev@localhost:5432/beatlume"
    database_url_sync: str = "postgresql://beatlume:beatlume_dev@localhost:5432/beatlume"

    # Redis — required
    redis_url: str = "redis://localhost:6379/0"

    # S3 — keep defaults for dev (MinIO)
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "beatlume"
    s3_secret_key: str = "beatlume_dev"
    s3_bucket_exports: str = "beatlume-exports"
    s3_bucket_assets: str = "beatlume-assets"
    s3_presigned_expiry: int = 3600

    # Auth — JWT secret MUST be set via env var in production
    jwt_secret_key: str = "dev-secret-change-in-production"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    sse_token_expire_seconds: int = 60

    # OAuth
    oauth_google_client_id: str = ""
    oauth_google_client_secret: str = ""
    oauth_github_client_id: str = ""
    oauth_github_client_secret: str = ""

    # AI / LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    ai_model_fast: str = "gpt-4o-mini"
    ai_model_standard: str = "gpt-4o"
    ai_model_powerful: str = "claude-sonnet-4-6"
    ai_model_scaffold: str = "claude-sonnet-4-6"
    # Fallback models when rate-limited (comma-separated)
    ai_model_fallbacks: str = (
        "openrouter/openai/gpt-4o-mini,openrouter/meta-llama/llama-3.1-8b-instruct"
    )
    # Max concurrent LLM calls (semaphore limit)
    ai_max_concurrent_calls: int = 3

    # Observability
    # OpenTelemetry Collector endpoint (receives both traces and metrics)
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"  # gRPC to OTel Collector
    otel_exporter_otlp_metrics_endpoint: str = (
        ""  # Use same endpoint as traces (Collector handles routing)
    )
    otel_service_name: str = "beatlume-api"
    otel_export_otlp_metrics: bool = True  # Export metrics via OTLP gRPC to Collector
    log_level: str = "INFO"
    log_format: str = "json"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    # Environment
    environment: str = "development"

    # Cookie config for refresh_token. In a same-site deployment (frontend and backend
    # share an eTLD+1, e.g. app.beatlume.io / api.beatlume.io) "lax" is fine. For a
    # cross-site deployment (frontend on Vercel, backend on Railway) "none" is required
    # AND secure must be True. Override via env if your prod is cross-site.
    cookie_samesite: str = "lax"
    cookie_secure_override: bool | None = None  # None = auto-detect from environment

    # Dev — uvicorn port (BACKEND_PORT in .env; Makefile uses same name)
    backend_port: int = 8000

    model_config = {"env_file": ".env", "case_sensitive": False}

    @property
    def cookie_secure(self) -> bool:
        """Whether to set the Secure flag on auth cookies.

        Auto-detects: True for any non-development environment. Override via
        COOKIE_SECURE_OVERRIDE env var if you need to force the value.
        """
        if self.cookie_secure_override is not None:
            return self.cookie_secure_override
        return self.environment != "development"


settings = Settings()
