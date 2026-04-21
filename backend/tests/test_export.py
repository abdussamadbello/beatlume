"""Tests for the export engine."""

from app.export import EXPORTERS, get_exporter
from app.export.base import ExportOptions, ExportResult
from app.export.plaintext import PlainTextExporter


# ── Registry ───────────────────────────────────────────────

def test_export_registry():
    assert set(EXPORTERS.keys()) == {"pdf", "docx", "epub", "plaintext"}


def test_get_exporter():
    exp = get_exporter("plaintext")
    assert isinstance(exp, PlainTextExporter)


def test_get_exporter_invalid():
    import pytest
    with pytest.raises(ValueError, match="Unknown export format"):
        get_exporter("html")


# ── Plaintext ──────────────────────────────────────────────

def test_plaintext_export():
    exporter = PlainTextExporter()
    result = exporter.export(
        story={"title": "Test Story", "id": "123"},
        chapters=[
            {
                "num": 1,
                "title": "Chapter One",
                "content": "It was a dark and stormy night.\n\nThe wind howled.",
            }
        ],
        settings=[{"key": "author", "value": "Test Author"}],
        options=ExportOptions(),
    )
    assert isinstance(result, ExportResult)
    assert result.filename == "test-story.txt"
    assert b"TEST STORY" in result.file_bytes
    assert b"CHAPTER 1" in result.file_bytes
    assert result.word_count > 0


def test_plaintext_no_title_page():
    exporter = PlainTextExporter()
    result = exporter.export(
        story={"title": "Test", "id": "1"},
        chapters=[{"num": 1, "title": "Ch1", "content": "Some text."}],
        settings=[],
        options=ExportOptions(include_title_page=False),
    )
    assert b"TEST" not in result.file_bytes.split(b"\n")[0] or b"CHAPTER" in result.file_bytes


def test_plaintext_scene_breaks():
    exporter = PlainTextExporter()
    result = exporter.export(
        story={"title": "Test", "id": "1"},
        chapters=[{"num": 1, "title": "Ch1", "content": "Para one.\n\n###\n\nPara two."}],
        settings=[],
        options=ExportOptions(),
    )
    assert b"* * *" in result.file_bytes


def test_plaintext_multiple_chapters():
    exporter = PlainTextExporter()
    result = exporter.export(
        story={"title": "Test", "id": "1"},
        chapters=[
            {"num": 1, "title": "Ch1", "content": "Chapter one text."},
            {"num": 2, "title": "Ch2", "content": "Chapter two text."},
        ],
        settings=[],
        options=ExportOptions(),
    )
    assert b"CHAPTER 1" in result.file_bytes
    assert b"CHAPTER 2" in result.file_bytes


# ── PDF ────────────────────────────────────────────────────

def test_pdf_export():
    from app.export.pdf import PDFExporter

    exporter = PDFExporter()
    result = exporter.export(
        story={"title": "Test Story", "id": "123"},
        chapters=[
            {
                "num": 1,
                "title": "Chapter One",
                "content": "Some prose content here.",
            }
        ],
        settings=[{"key": "author", "value": "Author"}],
        options=ExportOptions(),
    )
    assert len(result.file_bytes) > 0
    assert result.filename == "test-story.pdf"
    assert result.content_type == "application/pdf"
    # PDF magic bytes
    assert result.file_bytes[:4] == b"%PDF"


def test_pdf_multiple_chapters():
    from app.export.pdf import PDFExporter

    exporter = PDFExporter()
    result = exporter.export(
        story={"title": "Multi", "id": "1"},
        chapters=[
            {"num": 1, "title": "Ch1", "content": "First chapter."},
            {"num": 2, "title": "Ch2", "content": "Second chapter."},
        ],
        settings=[],
        options=ExportOptions(),
    )
    assert len(result.file_bytes) > 100


# ── DOCX ───────────────────────────────────────────────────

def test_docx_export():
    from app.export.docx_export import DOCXExporter

    exporter = DOCXExporter()
    result = exporter.export(
        story={"title": "Test Story", "id": "123"},
        chapters=[{"num": 1, "title": "Ch1", "content": "Docx text."}],
        settings=[{"key": "author", "value": "Writer"}],
        options=ExportOptions(),
    )
    assert len(result.file_bytes) > 0
    assert result.filename == "test-story.docx"
    # DOCX files are ZIP archives
    assert result.file_bytes[:2] == b"PK"


# ── ePub ───────────────────────────────────────────────────

def test_epub_export():
    from app.export.epub_export import EPUBExporter

    exporter = EPUBExporter()
    result = exporter.export(
        story={"title": "Test Story", "id": "123"},
        chapters=[{"num": 1, "title": "Ch1", "content": "ePub text here."}],
        settings=[{"key": "author", "value": "Writer"}],
        options=ExportOptions(),
    )
    assert len(result.file_bytes) > 0
    assert result.filename == "test-story.epub"
    assert result.content_type == "application/epub+zip"


# ── Base Exporter Helpers ──────────────────────────────────

def test_slugify():
    exp = PlainTextExporter()
    assert exp._slugify("Hello World!") == "hello-world"
    assert exp._slugify("  My Story: A Tale  ") == "my-story-a-tale"


def test_split_prose():
    exp = PlainTextExporter()
    result = exp._split_prose("Para 1.\n\n###\n\nPara 2.", scene_breaks=True)
    assert len(result) == 3
    assert result[1] == "###"


def test_split_prose_no_breaks():
    exp = PlainTextExporter()
    result = exp._split_prose("Para 1.\n\n###\n\nPara 2.", scene_breaks=False)
    assert len(result) == 2
    assert "###" not in result


def test_word_count():
    exp = PlainTextExporter()
    chapters = [
        {"content": "one two three"},
        {"content": "four five"},
    ]
    assert exp._count_words(chapters) == 5


def test_get_setting_case_insensitive():
    exp = PlainTextExporter()
    settings = [
        {"key": "Title", "value": "Seeded Title"},
        {"key": "Author", "value": "Elena Marsh"},
    ]
    assert exp._get_setting(settings, "title") == "Seeded Title"
    assert exp._get_setting(settings, "AUTHOR") == "Elena Marsh"
    assert exp._get_setting(settings, "missing", "fallback") == "fallback"


def test_plaintext_title_from_core_settings():
    exporter = PlainTextExporter()
    result = exporter.export(
        story={"title": "story-dict fallback", "id": "1"},
        chapters=[{"num": 1, "title": "Ch1", "content": "text."}],
        settings=[
            {"key": "Title", "value": "Canonical Title"},
            {"key": "Author", "value": "Elena Marsh"},
            {"key": "Genre", "value": "Literary fiction"},
        ],
        options=ExportOptions(),
    )
    body = result.file_bytes
    assert b"CANONICAL TITLE" in body
    assert b"by Elena Marsh" in body
    assert b"Literary fiction" in body


def test_pdf_title_from_core_settings():
    from app.export.pdf import PDFExporter

    exporter = PDFExporter()
    result = exporter.export(
        story={"title": "Fallback", "id": "1"},
        chapters=[{"num": 1, "title": "Ch1", "content": "Prose."}],
        settings=[
            {"key": "Title", "value": "Canonical Title"},
            {"key": "Author", "value": "Elena Marsh"},
            {"key": "Genre", "value": "Literary"},
        ],
        options=ExportOptions(),
    )
    assert result.file_bytes[:4] == b"%PDF"
    assert result.filename == "canonical-title.pdf"


def test_docx_title_from_core_settings():
    import zipfile
    import io

    from app.export.docx_export import DOCXExporter

    exporter = DOCXExporter()
    result = exporter.export(
        story={"title": "Fallback", "id": "1"},
        chapters=[{"num": 1, "title": "Ch1", "content": "Prose."}],
        settings=[
            {"key": "Title", "value": "Canonical Title"},
            {"key": "Author", "value": "Writer"},
            {"key": "Genre", "value": "Mystery"},
        ],
        options=ExportOptions(),
    )
    # DOCX is a ZIP with document.xml inside; grep that for the title + author + genre
    with zipfile.ZipFile(io.BytesIO(result.file_bytes)) as zf:
        doc_xml = zf.read("word/document.xml").decode("utf-8")
    assert "Canonical Title" in doc_xml
    assert "Writer" in doc_xml
    assert "Mystery" in doc_xml


def test_epub_title_from_core_settings():
    import zipfile
    import io

    from app.export.epub_export import EPUBExporter

    exporter = EPUBExporter()
    result = exporter.export(
        story={"title": "Fallback", "id": "1"},
        chapters=[{"num": 1, "title": "Ch1", "content": "Prose."}],
        settings=[
            {"key": "Title", "value": "Canonical Title"},
            {"key": "Author", "value": "Writer"},
            {"key": "Genre", "value": "Literary"},
        ],
        options=ExportOptions(),
    )
    assert result.filename == "canonical-title.epub"
    # Grep the metadata OPF for the title + author + subject
    with zipfile.ZipFile(io.BytesIO(result.file_bytes)) as zf:
        names = zf.namelist()
        opf = next((n for n in names if n.endswith(".opf")), None)
        assert opf is not None
        content = zf.read(opf).decode("utf-8")
    assert "Canonical Title" in content
    assert "Writer" in content
    assert "Literary" in content
