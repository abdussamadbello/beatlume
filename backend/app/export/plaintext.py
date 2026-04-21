"""Plain text exporter."""

from __future__ import annotations

from app.export.base import BaseExporter, ExportOptions, ExportResult


class PlainTextExporter(BaseExporter):
    """Generate plain UTF-8 text manuscripts."""

    def export(
        self,
        story: dict,
        chapters: list[dict],
        settings: list[dict],
        options: ExportOptions,
        on_progress: callable | None = None,
    ) -> ExportResult:
        lines: list[str] = []
        title = self._get_setting(settings, "title") or story.get("title", "Untitled")
        author = self._get_setting(settings, "author", "")
        genre = self._get_setting(settings, "genre", "")
        word_count = self._count_words(chapters)

        # Title page
        if options.include_title_page:
            lines.append(title.upper())
            if author:
                lines.append(f"by {author}")
            if genre:
                lines.append(genre)
            lines.append(f"{word_count:,} words")
            lines.append("")
            lines.append("=" * 60)
            lines.append("")

        # Chapters
        total = len(chapters)
        for idx, ch in enumerate(chapters):
            if options.include_chapter_headers:
                ch_num = ch.get("num", idx + 1)
                ch_title = ch.get("title", "")
                if ch_title:
                    lines.append(f"CHAPTER {ch_num}: {ch_title.upper()}")
                else:
                    lines.append(f"CHAPTER {ch_num}")
                lines.append("")

            content = ch.get("content", "")
            paras = self._split_prose(content, options.include_scene_breaks)

            for p in paras:
                if p == "###":
                    lines.append("")
                    lines.append("* * *")
                    lines.append("")
                else:
                    lines.append(p)
                    lines.append("")

            if idx < total - 1:
                lines.append("")
                lines.append("-" * 60)
                lines.append("")

            if on_progress:
                on_progress((idx + 1) / total)

        text = "\n".join(lines)
        slug = self._slugify(title)

        return ExportResult(
            file_bytes=text.encode("utf-8"),
            filename=f"{slug}.txt",
            content_type="text/plain; charset=utf-8",
            word_count=word_count,
        )
