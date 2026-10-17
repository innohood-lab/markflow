"""Postprocess module for MarkFlow conversion pipeline."""

from __future__ import annotations

import re
from pathlib import Path
from typing import List


def postprocess_markdown(
    markdown_text: str,
    format_type: str,
    source_path: str | Path | None = None,
) -> str:
    """
    Apply comprehensive post-processing rules to normalize and enhance Markdown output.
    """
    text = markdown_text

    # 1. Strip broken Unicode replacement characters
    text = text.replace("\ufffd", "")

    # 2. Format-specific post-processing
    fmt = (format_type or "").lower().lstrip(".")
    if fmt == "pdf":
        text = _clean_pdf_text(text)
    elif fmt == "pptx":
        text = _clean_pptx_text(text, source_path)
    elif fmt in ("xlsx", "xls", "csv"):
        text = _clean_spreadsheet_text(text, source_path)

    # 3. Clean headers, footers and page number artifacts
    text = _remove_page_artifacts(text)

    # 4. Normalize heading hierarchy
    text = _normalize_headings(text)

    # 5. Collapse multiple blank lines to at most one empty line (2 newlines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip() + "\n"


def _clean_pdf_text(text: str) -> str:
    """Unwrap hard line-breaks inside Korean/English paragraphs and fix hyphenation."""
    # Fix hyphenated word breaks at end of line: e.g. "connec-\ntion" -> "connection"
    text = re.sub(r"([a-zA-Z가-힣])-\n([a-zA-Z가-힣])", r"\1\2", text)

    lines = text.split("\n")
    processed: list[str] = []
    i = 0

    # Punctuation that marks definite end of a line/statement
    end_punct = (".", "!", "?", ":", ";", '"', "'", "”", "’", ")", "]", "}", "다.", "요.", "음.")

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # If line is a markdown element (heading, list, blockquote, table, code block, hr) or empty
        is_md_elem = (
            not stripped
            or stripped.startswith(("#", "-", "*", ">", "|", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "```", "---", "==="))
            or stripped.endswith("|")
        )

        if is_md_elem:
            processed.append(line)
            i += 1
            continue

        # Look ahead to see if next line should be joined
        if i + 1 < len(lines):
            next_line = lines[i + 1]
            next_stripped = next_line.strip()
            next_is_md = (
                not next_stripped
                or next_stripped.startswith(("#", "-", "*", ">", "|", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.", "```", "---", "==="))
                or next_stripped.endswith("|")
            )

            # If current line does not end with terminal punctuation and next line is standard text
            if not stripped.endswith(end_punct) and not next_is_md:
                # Merge with single space
                lines[i + 1] = f"{stripped} {next_stripped}"
                i += 1
                continue

        processed.append(line)
        i += 1

    return "\n".join(processed)


def _clean_pptx_text(text: str, source_path: str | Path | None) -> str:
    """Ensure clean PPTX slide separation and format presenter notes."""
    # If source path is provided and accessible, we can also extract presenter notes if missing
    notes_by_slide: dict[int, str] = {}
    if source_path:
        try:
            import pptx
            prs = pptx.Presentation(str(source_path))
            for idx, slide in enumerate(prs.slides, 1):
                if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                    note = slide.notes_slide.notes_text_frame.text.strip()
                    if note:
                        notes_by_slide[idx] = note
        except Exception:
            pass

    # Ensure slide headings are standardized
    # Standardize patterns like "# Slide 1" or "## 슬라이드 1"
    lines = text.split("\n")
    processed: list[str] = []
    slide_num = 0

    for line in lines:
        comment_match = re.match(r"^<!--\s*Slide number:\s*(\d+)\s*-->", line.strip(), re.IGNORECASE)
        slide_match = re.match(r"^#{1,3}\s*(?:Slide|슬라이드)\s*(\d+)[:.]?\s*(.*)$", line, re.IGNORECASE)

        if comment_match:
            slide_num = int(comment_match.group(1))
            line = f"## 슬라이드 {slide_num}"
        elif slide_match:
            slide_num = int(slide_match.group(1))
            title = slide_match.group(2).strip()
            title_part = f": {title}" if title else ""
            line = f"## 슬라이드 {slide_num}{title_part}"

        processed.append(line)

        # If we reached the end of a slide and have a presenter note, append it
        if slide_match and slide_num in notes_by_slide:
            note_content = notes_by_slide[slide_num]
            # check if note isn't already present
            if note_content not in text:
                processed.append(f"\n> **발표자 노트:** {note_content}\n")

    return "\n".join(processed)


def _clean_spreadsheet_text(text: str, source_path: str | Path | None) -> str:
    """Format spreadsheet markdown tables and handle row limits."""
    # Ensure sheet headings look like "## [시트명]"
    lines = text.split("\n")
    processed: list[str] = []
    table_row_count = 0
    max_table_rows = 500
    truncated = False

    for line in lines:
        # Detect Sheet heading
        sheet_match = re.match(r"^#{1,3}\s*(?:Sheet|시트)\s*[:.]?\s*(.*)$", line, re.IGNORECASE)
        if sheet_match:
            sheet_name = sheet_match.group(1).strip() or "시트"
            line = f"## {sheet_name}"
            table_row_count = 0
            truncated = False

        if line.strip().startswith("|") and line.strip().endswith("|"):
            table_row_count += 1
            if table_row_count > max_table_rows:
                if not truncated:
                    processed.append(f"\n*(이하 생략 - 500행 초과 데이터는 요약 처리되었습니다)*\n")
                    truncated = True
                continue

        processed.append(line)

    return "\n".join(processed)


def _remove_page_artifacts(text: str) -> str:
    """Remove common header/footer/page number patterns."""
    patterns = [
        r"^\s*(?:Page|페이지|\-)\s*\d+\s*(?:of|/)?\s*\d*\s*[\-\.]?\s*$",
        r"^\s*\[\s*\d+\s*\]\s*$",
        r"^\s*-\s*\d+\s*-\s*$",
    ]
    lines = text.split("\n")
    cleaned: list[str] = []
    for line in lines:
        if any(re.match(pat, line.strip(), re.IGNORECASE) for pat in patterns):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)


def _normalize_headings(text: str) -> str:
    """
    Ensure single H1 title and reasonable heading hierarchy (avoid skipping H2 -> H4).
    """
    lines = text.split("\n")
    h1_count = 0
    current_level = 0
    processed: list[str] = []

    for line in lines:
        h_match = re.match(r"^(#{1,6})\s+(.*)$", line)
        if h_match:
            hashes = h_match.group(1)
            title = h_match.group(2).strip()
            level = len(hashes)

            if level == 1:
                h1_count += 1
                if h1_count > 1:
                    # Downgrade subsequent H1s to H2
                    level = 2

            # Prevent skipping levels: e.g. level jumps from 1 to 3+
            if current_level > 0 and level > current_level + 1:
                level = current_level + 1

            current_level = level
            line = f"{'#' * level} {title}"

        processed.append(line)

    return "\n".join(processed)
