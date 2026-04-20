"""Export engine registry."""

from app.export.docx_export import DOCXExporter
from app.export.epub_export import EPUBExporter
from app.export.pdf import PDFExporter
from app.export.plaintext import PlainTextExporter

EXPORTERS: dict[str, type] = {
    "pdf": PDFExporter,
    "docx": DOCXExporter,
    "epub": EPUBExporter,
    "plaintext": PlainTextExporter,
}


def get_exporter(fmt: str):
    """Get an exporter instance by format name."""
    cls = EXPORTERS.get(fmt)
    if not cls:
        raise ValueError(f"Unknown export format: {fmt}")
    return cls()
