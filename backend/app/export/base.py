"""Base exporter interface and common types."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


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
    """Abstract base for all export format engines."""

    @abstractmethod
    def export(
        self,
        story: dict,
        chapters: list[dict],
        settings: list[dict],
        options: ExportOptions,
        on_progress: callable | None = None,
    ) -> ExportResult:
        ...

    def _slugify(self, title: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")

    def _split_prose(self, content: str, scene_breaks: bool) -> list[str]:
        paras = [p.strip() for p in content.split("\n\n") if p.strip()]
        if not scene_breaks:
            paras = [p for p in paras if p != "###"]
        return paras

    def _get_setting(self, settings: list[dict], key: str, default: str = "") -> str:
        for s in settings:
            if s.get("key") == key:
                return s.get("value", default)
        return default

    def _count_words(self, chapters: list[dict]) -> int:
        total = 0
        for ch in chapters:
            content = ch.get("content", "")
            total += len(content.split())
        return total
