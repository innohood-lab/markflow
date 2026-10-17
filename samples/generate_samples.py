import sys
from pathlib import Path

samples_dir = Path(__file__).resolve().parent

# 1. Plain Text
(samples_dir / "회의록_1017.txt").write_text(
    "# MarkFlow 개발 킥오프 회의록\n\n일시: 2026년 10월 17일\n참석자: 팀장, 개발에이전트\n\n## 주요 안건\n- Phase 2 변환 파이프라인 구축\n- 드래그 앤 드롭 UI 구현",
    encoding="utf-8"
)

# 2. Markdown / CSV / JSON
(samples_dir / "2026_실적분석.csv").write_text(
    "분기,매출액,영업이익,달성률\n1분기,12000,1500,105%\n2분기,14500,1800,110%\n3분기,13800,1650,98%",
    encoding="utf-8"
)

(samples_dir / "설정정보.json").write_text(
    '{\n  "service": "MarkFlow",\n  "version": "0.1.0",\n  "features": ["conversion", "export", "board"]\n}',
    encoding="utf-8"
)

# 3. HTML
(samples_dir / "기술블로그_스크랩.html").write_text(
    '<!DOCTYPE html><html><head><title>Antigravity 기술 백서</title></head><body><h1>Antigravity 차세대 지식 관리</h1><p>로컬 사이드카 아키텍처를 통한 안전한 데이터 처리 방식을 소개합니다.</p></body></html>',
    encoding="utf-8"
)

# 4. DOCX
try:
    import docx
    doc = docx.Document()
    doc.add_heading("2027 경영계획서 (Word)", level=1)
    doc.add_paragraph("본 문서는 2027년도 AX 추진 계획을 담은 전략 문서입니다.")
    doc.save(str(samples_dir / "경영계획_초안.docx"))
    print("DOCX created")
except Exception as e:
    print("DOCX failed:", e)

# 5. PPTX
try:
    from pptx import Presentation
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = "Argos 구조도 (PPT)"
    slide.placeholders[1].text = "차세대 개인 지식 관리 시스템 아키텍처"
    prs.save(str(samples_dir / "Argos_구조도.pptx"))
    print("PPTX created")
except Exception as e:
    print("PPTX failed:", e)

# 6. XLSX
try:
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "예산안"
    ws.append(["항목", "예산(만원)", "비고"])
    ws.append(["서버 비용", 0, "로컬 무료"])
    ws.append(["도메인", 15, "선택사항"])
    wb.save(str(samples_dir / "예산안_2027.xlsx"))
    print("XLSX created")
except Exception as e:
    print("XLSX failed:", e)

# 7. PDF (using pymupdf / fitz)
try:
    import fitz
    pdf_doc = fitz.open()
    page = pdf_doc.new_page()
    page.insert_text((50, 72), "MarkFlow PDF Document", fontsize=20)
    page.insert_text((50, 110), "This is a sample PDF document for MarkFlow Phase 2 test.", fontsize=12)
    pdf_doc.save(str(samples_dir / "샘플_보고서.pdf"))
    pdf_doc.close()
    print("PDF created")
except Exception as e:
    print("PDF failed:", e)

# 8. PNG Image
try:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (300, 150), color=(240, 244, 248))
    d = ImageDraw.Draw(img)
    d.text((30, 60), "MarkFlow Diagram", fill=(30, 41, 59))
    img.save(str(samples_dir / "아키텍처_도식.png"))
    print("PNG created")
except Exception as e:
    print("PNG failed:", e)

# 9. Unsupported dummy file
(samples_dir / "비공개_기안서.hwp").write_bytes(b"HWP DUMMY BINARY DATA FOR UNSUPPORTED FORMAT TEST")
print("HWP dummy created")
