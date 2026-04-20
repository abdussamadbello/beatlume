from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import structlog
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.api.router import api_router
from app.config import settings
from app.deps import engine, get_db
from app.telemetry.logging import setup_logging

limiter = Limiter(key_func=get_remote_address)

logger = structlog.get_logger()


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            origin = request.headers.get("origin")
            if origin and origin not in settings.cors_origins:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF check failed: origin not allowed"},
                )
        return await call_next(request)


# Configure structured logging at import time
setup_logging(log_level=settings.log_level, log_format=settings.log_format)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate critical config in non-dev environments
    if settings.environment != "development":
        if settings.jwt_secret_key == "dev-secret-change-in-production":
            raise RuntimeError("JWT_SECRET_KEY must be set in production")
        if "beatlume_dev" in settings.database_url:
            raise RuntimeError("DATABASE_URL appears to use dev credentials in production")

    # Initialize OpenTelemetry tracing and metrics
    from app.telemetry.setup import setup_telemetry
    setup_telemetry(app, engine, settings)
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(title="BeatLume API", version="0.1.0", lifespan=lifespan)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(CSRFMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "internal_error"},
        )

    @app.get("/health")
    async def health(db: AsyncSession = Depends(get_db)):
        checks = {}

        # Check database
        try:
            await db.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as e:
            checks["database"] = f"error: {str(e)}"

        # Check Redis
        try:
            r = aioredis.from_url(settings.redis_url)
            await r.ping()
            await r.aclose()
            checks["redis"] = "ok"
        except Exception as e:
            checks["redis"] = f"error: {str(e)}"

        all_ok = all(v == "ok" for v in checks.values())
        return JSONResponse(
            status_code=200 if all_ok else 503,
            content={"status": "ok" if all_ok else "degraded", "checks": checks},
        )

    return app


app = create_app()
