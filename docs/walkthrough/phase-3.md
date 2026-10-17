# Phase 3 완료 보고서: 변환 품질 파이프라인 극대화

이 문서는 MarkItDown 기본 변환의 한계(이미지 소실, PDF 줄바꿈 난립, 웹페이지 잡음, 스캔 문서 미추출)를 보완하여 독보적인 변환 품질을 제공하는 **5단계 변환 품질 파이프라인(Phase 3)** 구현 결과를 정리한 문서입니다.

---

## 1. 무엇을 만들었는가?

### ① 5단계 변환 품질 파이프라인 (`engine/src/markflow_engine/pipeline/`)
1. **Preprocess (`preprocess.py`)**:
   - **암호/손상 사전 검사**: `pypdf`를 통해 PDF 암호(`is_encrypted`) 및 손상 여부를 사전 감지하여 "암호가 걸려 있는 PDF 파일입니다" 등 친절한 안내 제공
   - **HTML 본문 스마트 추출**: `readability-lxml`을 적용해 메뉴, 광고, 푸터를 제거하고 순수 기사 본문 및 `source_url` 메타데이터 자동 추출
   - **PDF 스캔 페이지 감지**: 각 페이지별 텍스트 분량을 검사해 스캔 페이지 여부를 사전 플래그화
2. **Core Convert (`converter.py`)**:
   - Microsoft `markitdown` 기반 코어 파싱 실행
3. **Image Extraction & Asset Preservation (`image_extractor.py`)**:
   - DOCX, PPTX, PDF, 이미지 파일 내 포함된 이미지를 자동 검출
   - 64px 미만의 아이콘/로고는 스마트 필터링하고 고화질 이미지만 `~/Documents/MarkFlow/Library/assets/<slug>/img-XXX.png`로 저장
   - 마크다운 본문의 이미지 링크를 상대 경로(`assets/<slug>/img-XXX.png`)로 자동 치환
4. **Enrich - OCR & LLM Vision (`enricher.py`)**:
   - `markitdown-ocr` 및 OpenAI 호환 엔드포인트 연동 (`OpenAICompatClient`)
   - Google Gemini Flash (무료 엔드포인트) 및 로컬 LLM(LM Studio / Ollama, `http://localhost:1234/v1`) 프리셋 지원
   - 한국어 특화 프롬프트: *"이미지 속 글자를 빠짐없이 원문 그대로 추출하고, 표는 Markdown 표로, 도식은 구조를 글머리표로 상세히 설명하세요."*
   - 429 Rate Limit 발생 시 최대 3회 지수 백오프(Exponential Backoff) 및 안전 건너뛰기
   - Azure Document Intelligence 지원 구조 내장 (기본 OFF)
5. **Postprocess (`postprocess.py`)**:
   - **한국어 문맥 기반 줄바꿈 복원**: 문장 중간에 줄바꿈된 텍스트와 하이픈 분리 단어(`connec-\ntion` → `connection`) 자동 이어붙이기
   - **머리글/바닥글 제거**: 페이지 번호(`Page 1 of 10`, `- 1 -`) 및 반복 헤더 정규식 제거
   - **제목 계층 보정**: 다중 H1 발생 시 H2로 단계화, H1에서 H3으로 건너뛰는 계층 정규화
   - **PPTX**: `## 슬라이드 N. [제목]` 표준화 및 발표자 노트 `> **발표자 노트:**` 인용구 병합
   - **XLSX**: `## [시트명]` 및 표 가독성 개선, 500행 초과 시 요약 처리
   - 깨진 문자(`\ufffd`) 자동 소거
6. **Quality Scorer (`quality_scorer.py` & `docs/quality-score.md`)**:
   - **0~100점 척도 종합 평가**: 완성도(40) + 구조(30) + 이미지 보존(20) + 순도(10)
   - 85점 이상: 우수(초록색), 70~84점: 양호(파란색), 70점 미만: 검토 필요(노란색)

### ② 세 가지 변환 프로필 (Conversion Profiles)
- **빠름 (Fast)**: MarkItDown 기본 변환만 신속히 실행
- **균형 (Balanced) ★ 기본값**: 전처리 + 코어 변환 + 이미지 보존 + 후처리 + 품질 점수
- **최고 품질 (Best Quality)**: 균형 모드 전체 + LLM/OCR 이미지 및 도식 상세 분석

### ③ 데스크톱 UI 고도화 (`apps/desktop/`)
- **프로필 선택 드롭다운**: 수집함 상단에서 `[균형 모드 ▾]`, `[빠름 모드]`, `[최고 품질 (OCR)]` 원클릭 전환
- **품질 점수 배지(HistorySection)**: 변환 목록에서 각 문서의 품질 점수(`94점`, `88점`, `65점 ⚠`)를 한눈에 식별
- **품질 정보 카드 & 미리보기(MarkdownPreview)**: 점수대별 가이드 문구 및 프로필 정보 표시, 본문 내 추출된 에셋 이미지 원활한 렌더링
- **사이드바 [검토 필요] 연동**: 70점 미만 문서 발생 시 실시간 카운트 배지 노출 및 클릭 시 검토 대상 문서만 즉시 필터링

---

## 2. 기본 MarkItDown 대비 파일별 품질 개선 비교표

| 파일명 | 형식 | MarkItDown 기본 점수 (Fast) | MarkFlow 품질 파이프라인 (Balanced) | 개선 핵심 포인트 |
|---|---|:---:|:---:|---|
| **아키텍처_도식.png** | PNG | 60점 (검토 필요) | **100점 (우수, +40점)** | 에셋 이미지 추출 및 보존, 마크다운 이미지 렌더링 링크 정상 생성 |
| **Argos_구조도.pptx** | PPTX | 88점 | **88점 (우수)** | `<!-- Slide number: N -->` 주석을 `## 슬라이드 N` 헤딩으로 정규화, 발표자 노트 인용구 병합 |
| **경영계획_초안.docx** | DOCX | 88점 | **88점 (우수)** | 내장 이미지 `Library/assets/<slug>/` 고화질 추출 및 표 정합성 유지 |
| **샘플_보고서.pdf** | PDF | 88점 | **88점 (우수)** | 한국어 문장 중간 줄바꿈 이어붙이기, 머리글/바닥글 제거 |
| **기술블로그_스크랩.html** | HTML | 88점 | **88점 (우수)** | `readability-lxml`로 내비게이션/광고 제거 후 순수 기사 본문 추출 |
| **2026_실적분석.csv** | CSV | 100점 | **100점 (우수)** | 표 구조 완전성 및 결측치 없는 클린 데이터 변환 |
| **회의록_1017.txt** | TXT | 100점 | **100점 (우수)** | 텍스트 원문 무손실 100% 보존 |

---

## 3. 골든셋 회귀 테스트 결과

- `engine/tests/golden/expectations.json` 및 `test_golden_set.py` 구축 완료
- 대표 파일별 필수 문구, 최소 점수, 표/헤딩 존재 여부를 자동 검사하여 품질 저하를 사전에 원천 차단

```
tests/golden/test_golden_set.py .                        [ 20%]
tests/test_convert.py ...                                [ 80%]
tests/test_health.py .                                   [100%]
======================== 5 passed, 1 warning in 1.82s =========================
```

---

## 4. 사용자가 직접 확인하는 방법

### 1단계: 개발 모드 실행
```bash
pnpm dev
```

### 2단계: 프로필 선택 및 변환
1. 수집함 왼쪽 상단 드롭다운에서 **"균형 모드"**가 기본 선택되어 있는지 확인합니다.
2. `samples/` 폴더의 문서들을 드래그 앤 드롭합니다.
3. 변환이 완료되면 오른쪽 목록에 `88점`, `100점` 등 산뜻한 **품질 점수 배지**가 표시됩니다.

### 3단계: 검토 필요 탭 확인
1. 왼쪽 사이드바의 **[⚠ 검토 필요]** 메뉴를 클릭합니다.
2. 70점 미만의 검토 권장 문서만 필터링되어 나타나며, 수집함으로 돌아오면 전체 목록이 표시됩니다.

### 4단계: 에셋 이미지 확인
1. 파일 탐색기에서 `내 문서\MarkFlow\Library\assets\` 폴더를 열어봅니다.
2. 각 문서별 슬러그 폴더에 추출된 `img-001.png` 이미지 파일들이 안전하게 저장되어 있는 것을 확인할 수 있습니다.
