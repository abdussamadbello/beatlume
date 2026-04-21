"""ePub exporter using ebooklib."""

from __future__ import annotations

import io
import uuid as _uuid

from ebooklib import epub

from app.export.base import BaseExporter, ExportOptions, ExportResult


_DEFAULT_CSS = """
body { font-family: serif; line-height: 1.6; margin: 1em; }
h1 { text-align: center; margin-top: 2em; margin-bottom: 1em; }
p { text-indent: 1.5em; margin: 0; }
p.scene-break { text-indent: 0; text-align: center; margin: 1.5em 0; }
p.no-indent { text-indent: 0; }
"""


class EPUBExporter(BaseExporter):
    """Generate ePub e-books."""

    def export(
        self,
        story: dict,
        chapters: list[dict],
        settings: list[dict],
        options: ExportOptions,
        on_progress: callable | None = None,
    ) -> ExportResult:
        book = epub.EpubBook()
        title = self._get_setting(settings, "title") or story.get("title", "Untitled")
        author = self._get_setting(settings, "author", "Unknown")
        genre = self._get_setting(settings, "genre", "")
        word_count = self._count_words(chapters)

        # Metadata
        book.set_identifier(str(_uuid.uuid4()))
        book.set_title(title)
        book.set_language("en")
        book.add_author(author)
        if genre:
            book.add_metadata("DC", "subject", genre)

        # CSS
        css = epub.EpubItem(
            uid="style",
            file_name="style/default.css",
            media_type="text/css",
            content=_DEFAULT_CSS.encode("utf-8"),
        )
        book.add_item(css)

        epub_chapters = []
        spine = ["nav"]

        total = len(chapters)
        for idx, ch in enumerate(chapters):
            ch_num = ch.get("num", idx + 1)
            ch_title = ch.get("title", f"Chapter {ch_num}")
            filename = f"chapter_{ch_num:03d}.xhtml"

            ec = epub.EpubHtml(title=ch_title, file_name=filename, lang="en")
            ec.add_item(css)

            # Build HTML content
            html_parts = []
            if options.include_chapter_headers:
                html_parts.append(f"<h1>Chapter {ch_num}: {ch_title}</h1>")

            content = ch.get("content", "")
            paras = self._split_prose(content, options.include_scene_breaks)

            for p in paras:
                if p == "###":
                    html_parts.append('<p class="scene-break">* * *</p>')
                else:
                    safe = (
                        p.replace("&", "&amp;")
                        .replace("<", "&lt;")
                        .replace(">", "&gt;")
                    )
                    html_parts.append(f"<p>{safe}</p>")

            ec.content = "\n".join(html_parts).encode("utf-8")
            book.add_item(ec)
            epub_chapters.append(ec)
            spine.append(ec)

            if on_progress:
                on_progress((idx + 1) / total)

        # Table of contents
        book.toc = [(c, []) for c in epub_chapters]
        book.add_item(epub.EpubNcx())
        book.add_item(epub.EpubNav())
        book.spine = spine

        buf = io.BytesIO()
        epub.write_epub(buf, book)
        slug = self._slugify(title)

        return ExportResult(
            file_bytes=buf.getvalue(),
            filename=f"{slug}.epub",
            content_type="application/epub+zip",
            word_count=word_count,
        )
