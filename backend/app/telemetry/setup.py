"""OpenTelemetry setup for traces and metrics with auto-instrumentation."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncEngine
    from app.config import Settings

logger = logging.getLogger(__name__)


def setup_telemetry(app: FastAPI, engine: AsyncEngine, settings: Settings) -> None:
    """Initialize OpenTelemetry tracing and metrics.

    Wraps everything in try/except so the app starts even if Jaeger / OTLP
    collector is unavailable.
    """
    try:
        from opentelemetry import trace, metrics
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({
            "service.name": settings.otel_service_name,
            "service.version": "0.1.0",
            "deployment.environment": settings.environment,
        })

        # --- Tracing ---
        tracer_provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint)
        tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
        trace.set_tracer_provider(tracer_provider)

        # --- Metrics ---
        metric_exporter = OTLPMetricExporter(endpoint=settings.otel_exporter_otlp_endpoint)
        metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=60000)
        meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(meter_provider)

        # --- Auto-instrumentation ---
        _instrument_fastapi(app)
        _instrument_sqlalchemy(engine)
        _instrument_httpx()
        _instrument_celery()

        logger.info("OpenTelemetry initialized (endpoint=%s)", settings.otel_exporter_otlp_endpoint)

    except Exception:
        logger.warning("OpenTelemetry setup failed — telemetry disabled", exc_info=True)


def _instrument_fastapi(app):
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor.instrument_app(app)
    except Exception:
        logger.debug("FastAPI instrumentation skipped", exc_info=True)


def _instrument_sqlalchemy(engine):
    try:
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
    except Exception:
        logger.debug("SQLAlchemy instrumentation skipped", exc_info=True)


def _instrument_httpx():
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        HTTPXClientInstrumentor().instrument()
    except Exception:
        logger.debug("HTTPX instrumentation skipped", exc_info=True)


def _instrument_celery():
    try:
        from opentelemetry.instrumentation.celery import CeleryInstrumentor
        CeleryInstrumentor().instrument()
    except Exception:
        logger.debug("Celery instrumentation skipped", exc_info=True)
