import os
import re
import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from markflow_engine.pipeline import (
    preprocess_file,
    PreprocessResult,
    extract_and_preserve_images,
    ImageExtractionResult,
    enrich_image_file,
    LLMConfig,
    postprocess_markdown,
    evaluate_quality,
    QualityReport,
)

SUPPORTED_EXTENSIONS = {
    ".docx",
    ".pptx",
    ".xlsx",
    ".xls",
    ".pdf",
    ".html",
    ".htm",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".csv",
    ".txt",
    ".json",
    ".xml",
    ".zip",
}


def sanitize_slug(name: str) -> str:
    r"""
    Keep Korean, English, numbers and replace OS forbidden characters (\ / : * ? " < > |)
    """
    slug = re.sub(r'[\\/:*?"<>|]', "_", name).strip()
    slug = re.sub(r"\s+", " ", slug)
    return slug or "untitled"


def get_unique_library_path(library_dir: Path, slug: str) -> Path:
    """
    Ensure unique filename in Library: <slug>.md, <slug>-2.md, <slug>-3.md...
    """
    base_slug = slug
    target = library_dir / f"{base_slug}.md"
    counter = 2
    while target.exists():
        target = library_dir / f"{base_slug}-{counter}.md"
        counter += 1
    return target


def get_default_library_dir() -> Path:
    """
    Default Library directory:
    Windows: %USERPROFILE%/Documents/MarkFlow/Library
    macOS/Linux: ~/Documents/MarkFlow/Library
    """
    home = Path.home()
    lib = home / "Documents" / "MarkFlow" / "Library"
    lib.mkdir(parents=True, exist_ok=True)
    return lib


def generate_frontmatter(
    title: str,
    source_file: str,
    source_type: str,
    converted_at: str,
    engine_ver: str = "markitdown 0.1.8",
    quality_score: Optional[int] = None,
    status: str = "inbox",
    source_url: str = "",
    profile: str = "balanced",
) -> str:
    qs_str = str(quality_score) if quality_score is not None else "null"
    src_url_line = f'source_url: "{source_url}"\n' if source_url else ""
    return f"""---
title: "{title}"
source_file: "{source_file}"
source_type: "{source_type}"
converted_at: "{converted_at}"
engine: "{engine_ver}"
profile: "{profile}"
quality_score: {qs_str}
status: "{status}"
{src_url_line}tags: []
groups: []
category: ""
source_location: ""
exported:
  github: false
  obsidian: false
  gdrive: false
  onedrive: false
  dropbox: false
  icloud: false
---

"""


def convert_document(
    file_path: str,
    library_dir_str: Optional[str] = None,
    profile: str = "balanced",
    llm_config_dict: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Convert document through the MarkFlow 5-stage quality pipeline:
    1. Preprocess: check encryption, corruption, HTML readability, scan detection
    2. Core Convert: MarkItDown engine
    3. Enrich: OCR & LLM vision for images / scanned pages (if profile=best_quality)
    4. Postprocess: Korean broken line unwrapping, PPTX/XLSX formatting, heading normalization
    5. Quality Scorer: 0~100 score calculation and status classification
    """
    path = Path(file_path).resolve()

    if not path.exists():
        return {
            "status": "error",
            "message": f"파일을 찾을 수 없습니다: {path}",
            "file_name": path.name,
            "file_path": str(path),
        }

    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        return {
            "status": "unsupported",
            "message": f"MarkFlow에서 현재 지원하지 않는 포맷입니다 ({ext or '확장자 없음'})",
            "file_name": path.name,
            "file_path": str(path),
            "source_type": ext.lstrip("."),
        }

    file_size = path.stat().st_size
    if file_size == 0:
        return {
            "status": "error",
            "message": "파일 내용이 비어 있습니다 (0바이트).",
            "file_name": path.name,
            "file_path": str(path),
        }

    # Step 1: Preprocess & Preflight Checks
    prep = preprocess_file(path)
    if prep.is_encrypted or prep.is_corrupted:
        return {
            "status": "error",
            "message": prep.error_message or "파일을 읽을 수 없습니다.",
            "file_name": path.name,
            "file_path": str(path),
            "source_type": ext.lstrip("."),
        }

    # Determine Library directory
    if library_dir_str:
        lib_dir = Path(library_dir_str).resolve()
        lib_dir.mkdir(parents=True, exist_ok=True)
    else:
        lib_dir = get_default_library_dir()

    slug = sanitize_slug(path.stem)
    dest_path = get_unique_library_path(lib_dir, slug)
    actual_slug = dest_path.stem

    # LLM Config parsing
    llm_cfg = LLMConfig()
    if llm_config_dict:
        llm_cfg.enabled = llm_config_dict.get("enabled", False)
        llm_cfg.provider = llm_config_dict.get("provider", "local")
        llm_cfg.base_url = llm_config_dict.get("base_url", "http://localhost:1234/v1")
        llm_cfg.api_key = llm_config_dict.get("api_key", "not-needed")
        llm_cfg.model = llm_config_dict.get("model", "gemini-2.5-flash")

    # Step 2: Core Conversion with MarkItDown
    raw_markdown = ""
    title = path.stem

    try:
        from markitdown import MarkItDown

        md = MarkItDown()
        result = md.convert(str(prep.clean_path))
        raw_markdown = result.text_content or ""
        if result.title:
            cleaned_title = result.title.strip().replace("\n", " ").replace("\r", "")
            if cleaned_title:
                title = cleaned_title

    except Exception as e:
        prep.cleanup()
        err_msg = str(e)
        if "password" in err_msg.lower() or "encrypted" in err_msg.lower():
            friendly_err = "암호가 설정되어 열 수 없는 파일(PDF)입니다."
        elif "permission" in err_msg.lower():
            friendly_err = "파일에 접근할 권한이 없습니다."
        else:
            friendly_err = f"변환 중 오류가 발생했습니다: {err_msg}"

        return {
            "status": "error",
            "message": friendly_err,
            "file_name": path.name,
            "file_path": str(path),
            "error_detail": err_msg,
        }

    # Step 3: Enrich & Image Preservation
    processed_markdown = raw_markdown
    extracted_images_count = 0

    if profile in ("balanced", "best_quality"):
        # Image Extraction & Preservation into Library/assets/<slug>/
        img_res: ImageExtractionResult = extract_and_preserve_images(
            source_path=path,
            markdown_text=processed_markdown,
            library_dir=lib_dir,
            slug=actual_slug,
        )
        processed_markdown = img_res.updated_markdown
        extracted_images_count = len(img_res.extracted_images)

        # Enrich with OCR / LLM Vision if best_quality
        if profile == "best_quality":
            if ext in (".png", ".jpg", ".jpeg", ".webp") and (llm_cfg.enabled or not processed_markdown.strip()):
                ocr_text = enrich_image_file(path, llm_cfg)
                if ocr_text:
                    processed_markdown += f"\n\n### OCR 텍스트 및 구조 분석\n\n{ocr_text}\n"

            # If scanned PDF and OCR is enabled
            if prep.is_scanned_pdf and llm_cfg.enabled and img_res.extracted_images:
                scanned_ocr_parts: list[str] = []
                for img in img_res.extracted_images[:5]:  # limit to first 5 pages for responsiveness
                    page_text = enrich_image_file(img.absolute_path, llm_cfg)
                    if page_text:
                        scanned_ocr_parts.append(page_text)
                if scanned_ocr_parts:
                    processed_markdown += "\n\n### 스캔 페이지 OCR 추출\n\n" + "\n\n".join(scanned_ocr_parts)

        # Step 4: Postprocessing
        processed_markdown = postprocess_markdown(
            markdown_text=processed_markdown,
            format_type=ext,
            source_path=path,
        )

    # Step 5: Quality Scoring (0~100)
    quality_rep: QualityReport = evaluate_quality(
        markdown_text=processed_markdown,
        format_type=ext.lstrip("."),
        is_scanned=prep.is_scanned_pdf,
        scanned_pages=prep.scanned_pages,
        image_count=extracted_images_count,
        extracted_image_count=extracted_images_count,
    )

    # Clean up temp file from preprocessing if any
    prep.cleanup()

    # Frontmatter generation
    now_iso = datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat()
    source_type = ext.lstrip(".")

    frontmatter = generate_frontmatter(
        title=title,
        source_file=path.name,
        source_type=source_type,
        converted_at=now_iso,
        engine_ver="markitdown 0.1.8",
        quality_score=quality_rep.total_score,
        status="review_needed" if quality_rep.review_needed else "inbox",
        source_url=prep.source_url or "",
        profile=profile,
    )

    full_content = frontmatter + processed_markdown

    # Save to Library
    try:
        dest_path.write_text(full_content, encoding="utf-8")
    except Exception as save_err:
        return {
            "status": "error",
            "message": f"라이브러리에 파일 저장 실패: {str(save_err)}",
            "file_name": path.name,
            "file_path": str(path),
        }

    return {
        "status": "success",
        "title": title,
        "source_file": path.name,
        "source_path": str(path),
        "source_type": source_type,
        "file_size": file_size,
        "converted_at": now_iso,
        "library_path": str(dest_path),
        "slug": actual_slug,
        "profile": profile,
        "quality_score": quality_rep.total_score,
        "quality_report": {
            "score": quality_rep.total_score,
            "completeness": quality_rep.completeness,
            "structure": quality_rep.structure,
            "image_handling": quality_rep.image_handling,
            "purity": quality_rep.purity,
            "status": quality_rep.status,
            "review_needed": quality_rep.review_needed,
            "reasons": quality_rep.reasons,
        },
        "markdown": full_content,
        "raw_content": processed_markdown,
    }
