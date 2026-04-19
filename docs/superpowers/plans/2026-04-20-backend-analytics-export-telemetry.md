# BeatLume Backend Analytics, Export & Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining 3 subsystems: analytics computation engine (tension curves, pacing, presence, arcs, health scores), export engine (PDF/DOCX/ePub/plaintext), and telemetry (OpenTelemetry + structlog). These are the final plans before the backend is complete.

**Architecture:** Analytics are computed on-demand via service functions with Redis caching. Export uses a registry of format-specific engines behind a common interface, triggered by Celery tasks. Telemetry auto-instruments FastAPI, SQLAlchemy, and Celery with custom metrics.

**Tech Stack:** numpy, scipy (analytics), reportlab (PDF), python-docx (DOCX), ebooklib (ePub), opentelemetry-*, structlog, redis

---

### Task 1: Analytics — Tension + Pacing + Presence + Arcs + Health + Sparkline

**Files:**
- Create: `backend/app/services/analytics/__init__.py`
- Create: `backend/app/services/analytics/tension.py`
- Create: `backend/app/services/analytics/pacing.py`
- Create: `backend/app/services/analytics/presence.py`
- Create: `backend/app/services/analytics/arcs.py`
- Create: `backend/app/services/analytics/health.py`
- Create: `backend/app/services/analytics/sparkline.py`
- Create: `backend/app/api/analytics.py`
- Modify: `backend/app/api/router.py`

All analytics modules are pure computation — they take scene/character/edge data as input and return computed results. No LLM calls.

The analytics router should be at `/api/stories/{story_id}/analytics/*` with these endpoints:
- `GET /tension-curve` — TensionCurveData
- `GET /pacing` — PacingReport
- `GET /presence` — PresenceMatrix
- `GET /arcs` — list of CharacterArc
- `GET /health` — StoryHealth
- `GET /sparkline` — sparkline data

Each endpoint loads the relevant data from DB, runs the computation, and returns the result.

**Implementation approach:** Since these are pure math functions, implement them as stateless functions that take numpy arrays as input. The router fetches data from DB, converts to arrays, calls the function, and returns the result.

Create `backend/app/services/analytics/__init__.py` (empty).

Create `backend/app/services/analytics/tension.py`:
- `compute_tension_curve(tensions: list[int], acts: list[dict]) -> dict` — cubic spline interpolation (scipy), peak detection (scipy.signal.find_peaks with prominence>=2, distance>=3), valley detection, act boundaries, metrics (mean, std, max, min, range, climax_position, monotonicity)
- Peak labeling: first 25% → "Inciting incident", 40-60% → "Midpoint", last 30% highest → "Climax"

Create `backend/app/services/analytics/pacing.py`:
- `analyze_pacing(tensions: list[int]) -> dict` — velocity (diff), flatlines (runs with variance <= 1 for 3+ scenes), whiplash (jumps > 4), breathing room (after peaks >= 7, valley <= 4 within 3 scenes)

Create `backend/app/services/analytics/presence.py`:
- `compute_presence_matrix(scenes: list[dict], characters: list[dict], draft_content: dict[str, str]) -> dict` — binary matrix (absent/mentioned/POV), per-character stats (scene_count, pov_count, coverage, longest_gap, first/last appearance)

Create `backend/app/services/analytics/arcs.py`:
- `compute_character_arc(tensions: list[int], presence: list[int]) -> dict` — filter tensions where present, classify shape (rise/fall/rise-fall/fall-rise/flat/wave via linear regression + peak count)

Create `backend/app/services/analytics/health.py`:
- `compute_health_score(scenes, characters, edges, insights, draft_content, target_words) -> dict` — 6 weighted components (completion 0.20, pacing 0.20, character_coverage 0.20, relationship_density 0.15, structural_integrity 0.15, issue_load 0.10), grade A/B/C/D/F

Create `backend/app/services/analytics/sparkline.py`:
- `tension_sparkline(tensions: list[int], target_points: int = 12) -> list[float]` — LTTB downsampling

Create `backend/app/api/analytics.py` — router with all 6 endpoints, each fetching data and calling the service functions.

Add analytics router to `app/api/router.py`.

---

### Task 2: Export Engine

**Files:**
- Create: `backend/app/export/__init__.py`
- Create: `backend/app/export/base.py`
- Create: `backend/app/export/pdf.py`
- Create: `backend/app/export/docx_export.py`
- Create: `backend/app/export/epub_export.py`
- Create: `backend/app/export/plaintext.py`
- Create: `backend/app/tasks/export_tasks.py`
- Create: `backend/app/storage/__init__.py`
- Create: `backend/app/storage/s3.py`
- Create: `backend/app/api/export.py`
- Modify: `backend/app/api/router.py`

**Export base interface:**
```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class ExportOptions:
    include_title_page: bool = True
    include_chapter_headers: bool = True
    include_scene_breaks: bool = True
    page_size: str = "letter"
    font_family: str = "serif"
    font_size: int = 12
    line_spacing: float = 1.5

@dataclass
class ExportResult:
    file_bytes: bytes
    filename: str
    content_type: str
    word_count: int = 0

class BaseExporter(ABC):
    @abstractmethod
    def export(self, story, chapters, settings, options, on_progress=None) -> ExportResult:
        ...
```

**PDF exporter:** ReportLab with manuscript format (title page, chapter headers, 12pt serif, double-spaced, scene breaks with `# # #`).

**DOCX exporter:** python-docx with Word styles.

**ePub exporter:** ebooklib with HTML chapters, CSS, table of contents.

**Plain text exporter:** UTF-8 text with `CHAPTER N: TITLE` headers and `* * *` scene breaks.

**Registry:**
```python
EXPORTERS = {"pdf": PDFExporter, "docx": DOCXExporter, "epub": EPUBExporter, "plaintext": PlainTextExporter}
```

**S3 storage:**
```python
class S3Storage:
    def upload(self, key, data, content_type) -> str: ...
    def get_presigned_url(self, key, expiry) -> str: ...
    def delete(self, key) -> None: ...
```

**Export API endpoints:**
- `POST /api/stories/{story_id}/export` — trigger export (Celery task), returns task_id (202)
- `GET /api/stories/{story_id}/export/{job_id}` — check status + download URL

**Celery export task:** load story data, select exporter, generate, upload to S3, update ExportJob status.

---

### Task 3: Telemetry — OpenTelemetry + structlog

**Files:**
- Create: `backend/app/telemetry/__init__.py`
- Create: `backend/app/telemetry/setup.py`
- Create: `backend/app/telemetry/traces.py`
- Create: `backend/app/telemetry/metrics.py`
- Create: `backend/app/telemetry/logging.py`
- Modify: `backend/app/main.py` — initialize telemetry in lifespan

**Setup:**
- OpenTelemetry SDK with resource (service.name, version, environment)
- TracerProvider with BatchSpanProcessor + OTLPSpanExporter
- MeterProvider with PeriodicExportingMetricReader + OTLPMetricExporter
- Auto-instrument: FastAPI, SQLAlchemy, httpx, Celery

**Custom metrics:** (meter name: "beatlume")
- `ai.task.duration` histogram
- `ai.tokens.total` counter
- `analytics.compute.duration` histogram
- `analytics.cache.hit` / `analytics.cache.miss` counters
- `export.duration` histogram
- `sse.connections.active` up_down_counter

**Traces:**
- `@traced(span_name)` decorator for span wrapping
- `trace_ai_call()` helper to record model, tokens on current span

**Structured logging:**
- structlog configured with JSON output + trace context injection (trace_id, span_id)
- `add_trace_context` processor injects OTel trace/span IDs

**Integration in main.py:** Call `setup_telemetry(app, engine, settings)` during lifespan startup. Call `setup_logging(settings.log_level, settings.log_format)` at module level.

---

### Task 4: Tests for Analytics + Export + Final verification

**Files:**
- Create: `backend/tests/test_analytics.py`
- Create: `backend/tests/test_export.py`

**Analytics tests:**
- `test_tension_curve_basic` — 10 tensions → produces curve with peaks
- `test_pacing_flatline_detection` — [3,3,3,3,5] → detects flatline
- `test_pacing_whiplash_detection` — [2,8,3] → detects whiplash
- `test_health_score_range` — returns 0-100 with grade
- `test_sparkline_downsampling` — 40 points → 12 points

**Export tests:**
- `test_plaintext_export` — generates text with title + chapters
- `test_export_registry` — all 4 formats registered
- `test_pdf_export_creates_bytes` — generates non-empty PDF bytes

**Final:** Run all tests, verify total > 55.

---

## Verification Checklist

1. Analytics endpoints return computed data (tension curve, pacing, presence, arcs, health, sparkline)
2. Export engine generates files in 4 formats
3. Export Celery task runs and uploads to S3
4. Telemetry initializes without errors
5. structlog produces JSON logs with trace context
6. All tests pass (target: 60+)
