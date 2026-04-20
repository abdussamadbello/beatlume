"""PDF exporter using ReportLab."""

from __future__ import annotations

import io

from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    PageBreak,
)

from app.export.base import BaseExporter, ExportOptions, ExportResult


PAGE_SIZES = {"letter": letter, "a4": A4}


class PDFExporter(BaseExporter):
    """Generate manuscript-format PDF via ReportLab."""

    def export(
        self,
        story: dict,
        chapters: list[dict],
        settings: list[dict],
        options: ExportOptions,
        on_progress: callable | None = None,
    ) -> ExportResult:
        buf = io.BytesIO()
        page_size = PAGE_SIZES.get(options.page_size, letter)

        doc = SimpleDocTemplate(
            buf,
            pagesize=page_size,
            topMargin=1 * inch,
            bottomMargin=1 * inch,
            leftMargin=1.25 * inch,
            rightMargin=1.25 * inch,
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "ManuscriptTitle",
            parent=styles["Title"],
            fontSize=24,
            alignment=TA_CENTER,
            spaceAfter=12,
        )
        author_style = ParagraphStyle(
            "ManuscriptAuthor",
            parent=styles["Normal"],
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=6,
        )
        chapter_style = ParagraphStyle(
            "ChapterHeader",
            parent=styles["Heading1"],
            fontSize=16,
            alignment=TA_CENTER,
            spaceBefore=36,
            spaceAfter=24,
        )
        body_style = ParagraphStyle(
            "ManuscriptBody",
            parent=styles["Normal"],
            fontSize=options.font_size,
            leading=options.font_size * options.line_spacing,
            alignment=TA_JUSTIFY,
            firstLineIndent=24,
            spaceAfter=0,
        )
        scene_break_style = ParagraphStyle(
            "SceneBreak",
            parent=styles["Normal"],
            fontSize=options.font_size,
            alignment=TA_CENTER,
            spaceBefore=12,
            spaceAfter=12,
        )

        elements = []
        title = story.get("title", "Untitled")
        author = self._get_setting(settings, "author", "")
        word_count = self._count_words(chapters)

        # Title page
        if options.include_title_page:
            elements.append(Spacer(1, 2 * inch))
            elements.append(Paragraph(title, title_style))
            if author:
                elements.append(Paragraph(f"by {author}", author_style))
            elements.append(Spacer(1, 0.5 * inch))
            elements.append(
                Paragraph(f"{word_count:,} words", author_style)
            )
            elements.append(PageBreak())

        # Chapters
        total = len(chapters)
        for idx, ch in enumerate(chapters):
            if options.include_chapter_headers:
                ch_title = ch.get("title", f"Chapter {ch.get('num', idx + 1)}")
                header = f"CHAPTER {ch.get('num', idx + 1)}: {ch_title.upper()}"
                elements.append(Paragraph(header, chapter_style))

            content = ch.get("content", "")
            paras = self._split_prose(content, options.include_scene_breaks)

            for p in paras:
                if p == "###":
                    elements.append(Paragraph("# # #", scene_break_style))
                else:
                    # Escape XML entities for ReportLab
                    safe = (
                        p.replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                    )
                    elements.append(Paragraph(safe, body_style))

            if idx < total - 1:
                elements.append(PageBreak())

            if on_progress:
                on_progress((idx + 1) / total)

        doc.build(elements)
        slug = self._slugify(title)

        return ExportResult(
            file_bytes=buf.getvalue(),
            filename=f"{slug}.pdf",
            content_type="application/pdf",
            word_count=word_count,
        )
