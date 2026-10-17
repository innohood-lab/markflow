import os
import re
import datetime
from pathlib import Path
from typing import Dict, Any, Optional

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
    # Replace OS invalid characters with underscore
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
    status: str = "미분류",
) -> str:
    qs_str = str(quality_score) if quality_score is not None else "null"
    return f"""---
title: "{title}"
source_file: "{source_file}"
source_type: "{source_type}"
converted_at: "{converted_at}"
engine: "{engine_ver}"
quality_score: {qs_str}
status: "{status}"
tags: []
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


def convert_document(file_path: str, library_dir_str: Optional[str] = None) -> Dict[str, Any]:
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
            "message": f"지원하지 않는 파일 형식입니다 ({ext or '확장자 없음'})",
            "file_name": path.name,
            "file_path": str(path),
            "source_type": ext.lstrip("."),
        }

    file_size = path.stat().st_size

    # Check for empty files
    if file_size == 0:
        return {
            "status": "error",
            "message": "파일 내용이 비어 있습니다 (0바이트).",
            "file_name": path.name,
            "file_path": str(path),
        }

    # Attempt conversion with MarkItDown
    try:
        from markitdown import MarkItDown

        md = MarkItDown()
        result = md.convert(str(path))
        raw_markdown = result.text_content or ""
        title = result.title or path.stem

        # Clean title
        title = title.strip().replace("\n", " ").replace("\r", "")
        if not title:
            title = path.stem
    except Exception as e:
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

    # Determine Library directory
    if library_dir_str:
        lib_dir = Path(library_dir_str).resolve()
        lib_dir.mkdir(parents=True, exist_ok=True)
    else:
        lib_dir = get_default_library_dir()

    # Determine slug and destination
    slug = sanitize_slug(path.stem)
    dest_path = get_unique_library_path(lib_dir, slug)
    actual_slug = dest_path.stem

    now_iso = datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat()
    source_type = ext.lstrip(".")

    frontmatter = generate_frontmatter(
        title=title,
        source_file=path.name,
        source_type=source_type,
        converted_at=now_iso,
        engine_ver="markitdown 0.1.8",
        quality_score=None,
        status="미분류",
    )

    full_content = frontmatter + raw_markdown

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
        "markdown": full_content,
        "raw_content": raw_markdown,
    }
