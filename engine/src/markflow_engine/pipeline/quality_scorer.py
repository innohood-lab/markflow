"""Quality scoring module for MarkFlow conversion pipeline."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class QualityReport:
    """Detailed quality evaluation report for a converted document."""
    total_score: int
    completeness: int
    structure: int
    image_handling: int
    purity: int
    status: str  # "good" | "fair" | "review_needed"
    review_needed: bool
    reasons: List[str] = field(default_factory=list)


def evaluate_quality(
    markdown_text: str,
    format_type: str,
    is_scanned: bool = False,
    scanned_pages: list[int] | None = None,
    image_count: int = 0,
    extracted_image_count: int = 0,
) -> QualityReport:
    """
    Calculate an objective 0~100 quality score for converted Markdown.
    """
    text = (markdown_text or "").strip()
    reasons: list[str] = []

    # 1. Completeness (최대 40점)
    completeness = 40
    char_count = len(text)

    if char_count == 0:
        completeness = 0
        reasons.append("추출된 텍스트가 전혀 없습니다.")
    elif is_scanned and char_count < 100:
        completeness = 10
        reasons.append(f"스캔 문서({len(scanned_pages or [])}페이지)에서 텍스트가 충분히 추출되지 않았습니다.")
    elif char_count < 30 and format_type not in ("png", "jpg", "jpeg", "webp"):
        completeness = 15
        reasons.append("추출된 본문 길이가 너무 짧습니다.")
    elif char_count < 100 and format_type not in ("png", "jpg", "jpeg", "webp"):
        completeness = 28

    # 2. Structure (최대 30점)
    structure = 30
    has_headings = bool(re.search(r"^#{1,6}\s+", text, re.MULTILINE))
    has_tables = bool(re.search(r"^\|.+\|$\s*^\|[-:| ]+\|\$", text, re.MULTILINE))
    has_lists = bool(re.search(r"^[\*\-\+]\s+", text, re.MULTILINE) or re.search(r"^\d+\.\s+", text, re.MULTILINE))

    # Heading check
    if not has_headings and char_count > 300:
        structure -= 8
        reasons.append("제목 계층(Heading)이 식별되지 않았습니다.")

    # Table formatting integrity
    table_lines = [line for line in text.split("\n") if line.strip().startswith("|") and line.strip().endswith("|")]
    if table_lines:
        # Check column consistency
        col_counts = [line.count("|") for line in table_lines if not re.match(r"^\|[-:| ]+\|$", line.strip())]
        if col_counts and len(set(col_counts)) > 2:
            structure -= 7
            reasons.append("표(Table) 열 개수가 일부 일치하지 않습니다.")

    # If document has neither headings, lists, nor tables despite being long
    if char_count > 500 and not (has_headings or has_tables or has_lists):
        structure -= 10
        reasons.append("문서의 구조화 요소(제목/목록/표)가 결여되어 있습니다.")

    structure = max(5, structure)

    # 3. Image & Asset Handling (최대 20점)
    image_handling = 20
    if image_count > 0:
        if extracted_image_count >= image_count:
            image_handling = 20
        elif extracted_image_count > 0:
            ratio = extracted_image_count / image_count
            image_handling = max(10, int(20 * ratio))
            reasons.append(f"내장 이미지 {image_count}개 중 {extracted_image_count}개만 보존되었습니다.")
        else:
            image_handling = 5
            reasons.append(f"내장 이미지 {image_count}개가 보존되지 못했습니다.")
    else:
        # No images in original doc -> full points
        image_handling = 20

    # 4. Purity (최대 10점)
    purity = 10
    broken_chars = text.count("\ufffd")
    if broken_chars > 0:
        purity -= min(10, broken_chars * 2)
        reasons.append(f"깨진 문자({broken_chars}건)가 감지되었습니다.")

    # High ratio of non-printable / odd characters
    total_score = max(0, min(100, completeness + structure + image_handling + purity))

    # Status classification
    if total_score >= 85:
        status = "good"
        review_needed = False
    elif total_score >= 70:
        status = "fair"
        review_needed = False
    else:
        status = "review_needed"
        review_needed = True

    return QualityReport(
        total_score=total_score,
        completeness=completeness,
        structure=structure,
        image_handling=image_handling,
        purity=purity,
        status=status,
        review_needed=review_needed,
        reasons=reasons,
    )
