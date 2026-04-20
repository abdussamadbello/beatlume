from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.config import settings
from app.deps import engine
from app.telemetry.logging import setup_logging

# Configure structured logging at import time
setup_logging(log_level=settings.log_level, log_format=settings.log_format)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize OpenTelemetry tracing and metrics
    from app.telemetry.setup import setup_telemetry
    setup_telemetry(app, engine, settings)
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(title="BeatLume API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
