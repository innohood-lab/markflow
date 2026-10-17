"""Preprocess module for MarkFlow conversion pipeline."""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
import chardet
from bs4 import BeautifulSoup
import pypdf
from readability import Document


@dataclass
class PreprocessResult:
    """Result of preprocessing step."""
    clean_path: Path
    original_path: Path
    format: str
    is_encrypted: bool = False
    is_corrupted: bool = False
    is_scanned_pdf: bool = False
    scanned_pages: list[int] = field(default_factory=list)
    total_pages: int = 0
    source_url: str | None = None
    error_message: str | None = None
    temp_file: tempfile.NamedTemporaryFile | None = None

    def cleanup(self) -> None:
        """Clean up temporary resources if created."""
        if self.temp_file is not None:
            try:
                self.temp_file.close()
                if os.path.exists(self.temp_file.name):
                    os.unlink(self.temp_file.name)
            except Exception:
                pass


def preprocess_file(file_path: str | Path) -> PreprocessResult:
    """
    Perform format-specific preprocessing and pre-flight checks.
    """
    path = Path(file_path).resolve()
    if not path.exists():
        return PreprocessResult(
            clean_path=path,
            original_path=path,
            format="unknown",
            is_corrupted=True,
            error_message="파일이 존재하지 않습니다.",
        )

    ext = path.suffix.lower().lstrip(".")

    # 1. PDF preprocessing
    if ext == "pdf":
        return _preprocess_pdf(path)

    # 2. HTML preprocessing
    if ext in ("html", "htm"):
        return _preprocess_html(path)

    # 3. Default pass-through
    return PreprocessResult(
        clean_path=path,
        original_path=path,
        format=ext,
    )


def _preprocess_pdf(path: Path) -> PreprocessResult:
    """Inspect PDF for encryption, corruption, and scanned pages."""
    try:
        reader = pypdf.PdfReader(str(path))
        if reader.is_encrypted:
            return PreprocessResult(
                clean_path=path,
                original_path=path,
                format="pdf",
                is_encrypted=True,
                error_message="암호가 걸려 있는 PDF 파일입니다. 암호를 해제한 후 다시 시도해주세요.",
            )

        total_pages = len(reader.pages)
        scanned_pages: list[int] = []

        for idx, page in enumerate(reader.pages):
            try:
                text = (page.extract_text() or "").strip()
                # If extracted text is less than 30 characters, consider it a scanned/image page
                if len(text) < 30:
                    scanned_pages.append(idx + 1)
            except Exception:
                scanned_pages.append(idx + 1)

        is_scanned = len(scanned_pages) == total_pages and total_pages > 0

        return PreprocessResult(
            clean_path=path,
            original_path=path,
            format="pdf",
            total_pages=total_pages,
            is_scanned_pdf=is_scanned,
            scanned_pages=scanned_pages,
        )

    except Exception as e:
        return PreprocessResult(
            clean_path=path,
            original_path=path,
            format="pdf",
            is_corrupted=True,
            error_message=f"손상되었거나 읽을 수 없는 PDF 파일입니다: {str(e)}",
        )


def _preprocess_html(path: Path) -> PreprocessResult:
    """Extract clean article content using readability-lxml and detect source URL."""
    try:
        raw_bytes = path.read_bytes()
        detected = chardet.detect(raw_bytes)
        encoding = detected.get("encoding") or "utf-8"

        try:
            html_text = raw_bytes.decode(encoding)
        except Exception:
            html_text = raw_bytes.decode("utf-8", errors="replace")

        # Try to extract source URL from metadata
        soup = BeautifulSoup(html_text, "html.parser")
        source_url: str | None = None
        canonical = soup.find("link", rel="canonical")
        if canonical and canonical.get("href"):
            source_url = str(canonical["href"])
        else:
            og_url = soup.find("meta", property="og:url")
            if og_url and og_url.get("content"):
                source_url = str(og_url["content"])

        # Extract main article content via readability
        doc = Document(html_text)
        clean_html = f"<html><head><title>{doc.title()}</title></head><body>{doc.summary()}</body></html>"

        # Write clean html to a temporary file
        temp = tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8")
        temp.write(clean_html)
        temp.flush()
        temp.close()

        return PreprocessResult(
            clean_path=Path(temp.name),
            original_path=path,
            format="html",
            source_url=source_url,
            temp_file=temp,
        )

    except Exception:
        # Fallback to original html file if readability fails
        return PreprocessResult(
            clean_path=path,
            original_path=path,
            format="html",
        )
