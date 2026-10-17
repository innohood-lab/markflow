"""Image extraction and preservation module for MarkFlow conversion pipeline."""

from __future__ import annotations

import base64
import io
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from PIL import Image


@dataclass
class ExtractedImage:
    """Metadata of an extracted image."""
    filename: str
    relative_path: str
    absolute_path: Path
    width: int
    height: int
    format: str


@dataclass
class ImageExtractionResult:
    """Result of image extraction."""
    updated_markdown: str
    extracted_images: List[ExtractedImage] = field(default_factory=list)


def extract_and_preserve_images(
    source_path: str | Path,
    markdown_text: str,
    library_dir: str | Path,
    slug: str,
) -> ImageExtractionResult:
    """
    Extract embedded images from document/markdown, save to Library/assets/<slug>/,
    and update Markdown image links to relative paths.
    """
    source = Path(source_path).resolve()
    assets_dir = Path(library_dir).resolve() / "assets" / slug
    assets_dir.mkdir(parents=True, exist_ok=True)

    extracted: List[ExtractedImage] = []
    current_md = markdown_text
    img_counter = 1

    # 1. Process inline data URIs in markdown
    # Regex for ![alt](data:image/png;base64,...)
    data_uri_pattern = re.compile(
        r'!\[(.*?)\]\(data:image\/([a-zA-Z0-9_\-\+]+);base64,([A-Za-z0-9+/=\r\n]+)\)'
    )

    def replace_data_uri(match: re.Match) -> str:
        nonlocal img_counter
        alt = match.group(1) or f"이미지 {img_counter}"
        raw_ext = match.group(2).lower()
        ext = "jpg" if raw_ext in ("jpeg", "jpg") else ("png" if raw_ext == "png" else "png")
        b64_data = match.group(3).replace("\n", "").replace("\r", "")

        try:
            img_bytes = base64.b64decode(b64_data)
            with Image.open(io.BytesIO(img_bytes)) as pil_img:
                w, h = pil_img.size
                if w < 64 or h < 64 or len(img_bytes) < 512:
                    return ""  # Discard tiny icons/logos

                filename = f"img-{img_counter:03d}.{ext}"
                target_file = assets_dir / filename
                target_file.write_bytes(img_bytes)

                rel_path = f"assets/{slug}/{filename}"
                extracted.append(
                    ExtractedImage(
                        filename=filename,
                        relative_path=rel_path,
                        absolute_path=target_file,
                        width=w,
                        height=h,
                        format=ext,
                    )
                )
                img_counter += 1
                return f"![{alt}]({rel_path})"
        except Exception:
            return ""

    current_md = data_uri_pattern.sub(replace_data_uri, current_md)

    # 2. Extract embedded images directly from binary formats if not already covered
    ext = source.suffix.lower().lstrip(".")
    raw_images: list[tuple[bytes, str]] = []

    if ext == "docx":
        raw_images = _extract_docx_images(source)
    elif ext == "pptx":
        raw_images = _extract_pptx_images(source)
    elif ext == "pdf":
        raw_images = _extract_pdf_images(source)
    elif ext in ("png", "jpg", "jpeg", "webp"):
        # For standalone image files, save a copy in assets
        try:
            img_bytes = source.read_bytes()
            raw_images = [(img_bytes, ext)]
        except Exception:
            pass

    # Save newly extracted binary images
    newly_added_md: list[str] = []
    seen_hashes: set[int] = set()

    for img_bytes, img_ext in raw_images:
        h_val = hash(img_bytes)
        if h_val in seen_hashes:
            continue
        seen_hashes.add(h_val)

        try:
            with Image.open(io.BytesIO(img_bytes)) as pil_img:
                w, h = pil_img.size
                if w < 64 or h < 64 or len(img_bytes) < 1024:
                    continue  # Skip icons/tiny shapes

                filename = f"img-{img_counter:03d}.{img_ext}"
                target_file = assets_dir / filename
                target_file.write_bytes(img_bytes)

                rel_path = f"assets/{slug}/{filename}"
                extracted.append(
                    ExtractedImage(
                        filename=filename,
                        relative_path=rel_path,
                        absolute_path=target_file,
                        width=w,
                        height=h,
                        format=img_ext,
                    )
                )
                newly_added_md.append(f"![이미지 {img_counter}]({rel_path})")
                img_counter += 1
        except Exception:
            continue

    # If document has standalone images and markdown doesn't have them linked, append them
    if newly_added_md:
        if ext in ("png", "jpg", "jpeg", "webp"):
            # For pure image, replace or prepend image
            current_md = f"{newly_added_md[0]}\n\n" + current_md.strip()
        elif "assets/" not in current_md:
            current_md = current_md.rstrip() + "\n\n### 첨부 이미지\n\n" + "\n\n".join(newly_added_md) + "\n"

    return ImageExtractionResult(
        updated_markdown=current_md,
        extracted_images=extracted,
    )


def _extract_docx_images(path: Path) -> list[tuple[bytes, str]]:
    """Extract embedded images from DOCX relationships."""
    images: list[tuple[bytes, str]] = []
    try:
        import docx
        doc = docx.Document(str(path))
        for rel in doc.part.related_parts.values():
            if hasattr(rel, "content_type") and rel.content_type.startswith("image/"):
                raw_ext = rel.content_type.split("/")[-1].lower()
                ext = "png" if "png" in raw_ext else ("jpg" if "jpeg" in raw_ext or "jpg" in raw_ext else "png")
                images.append((rel.blob, ext))
    except Exception:
        pass
    return images


def _extract_pptx_images(path: Path) -> list[tuple[bytes, str]]:
    """Extract embedded images from PPTX slides."""
    images: list[tuple[bytes, str]] = []
    try:
        import pptx
        prs = pptx.Presentation(str(path))
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "image") and shape.image is not None:
                    raw_ext = shape.image.content_type.split("/")[-1].lower() if shape.image.content_type else "png"
                    ext = "png" if "png" in raw_ext else ("jpg" if "jpeg" in raw_ext or "jpg" in raw_ext else "png")
                    images.append((shape.image.blob, ext))
    except Exception:
        pass
    return images


def _extract_pdf_images(path: Path) -> list[tuple[bytes, str]]:
    """Extract embedded images from PDF pages."""
    images: list[tuple[bytes, str]] = []
    try:
        import pypdf
        reader = pypdf.PdfReader(str(path))
        for page in reader.pages:
            for img_file in page.images:
                ext = Path(img_file.name).suffix.lower().lstrip(".")
                if not ext:
                    ext = "png"
                images.append((img_file.data, ext))
    except Exception:
        pass
    return images
