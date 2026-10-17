# Phase 4 완료 보고서: 상세 보기 · 원본 비교 · 마크다운 편집

이 문서는 변환된 문서를 정밀하게 검토하고 교정할 수 있도록 구현된 **상세 보기 · 원본 비교 · 편집(Phase 4)** 기능의 결과 및 검증 내용을 정리한 문서입니다.

---

## 1. 구현 핵심 요약

### ① 집중 상세 뷰 모드 (`DetailViewer.tsx`)
- 수집함 목록에서 문서를 더블 클릭하거나 `[상세]` 버튼을 클릭하면 수집함 2분할 뷰에서 **집중 상세 워크스페이스**로 전환됩니다.
- 상단 내비게이션 바:
  - `(← 수집함)` 원클릭 복귀 버튼 (ESC 키 연동)
  - 문서 제목 및 형식 태그 노출
  - 유용한 빠른 작업 버튼:
    - `[🔄 재변환]`: 다른 프로필로 안전하게 다시 변환
    - `[📁 탐색기]`: 변환된 마크다운 파일이 위치한 폴더 즉시 열기
    - `[📋 MD 복사]`: 클립보드에 마크다운 본문 복사 (성공 시 2초간 `복사됨!` 피드백)
    - `[🗑 삭제]`: 보관함에서 항목 제거
  - **3가지 탭 스위처**: `[미리보기]`, `[원본 비교]`, `[편집]`

### ② 노션(Notion) 스타일 프론트매터 속성 패널 (`FrontmatterForm.tsx`)
- 상세 보기 상단에 접이식(Collapsible)으로 배치된 메타데이터 속성 패널입니다.
- **편집 가능 필드**:
  - **제목 (Title)**: 문서 제목 변경 시 마크다운 헤더 및 DB 즉시 동기화
  - **상태 (Status)**: `수집됨 (inbox)`, `검토 필요 (review_needed)`, `내보내기 대기 (ready)`, `내보내기 완료 (exported)` 드롭다운 선택
  - **카테고리 (Category)**: 자유 텍스트 입력
  - **태그 (Tags)**: 칩(Chip) 형태의 태그 목록, 새 태그 입력/추가, 개별 태그 삭제(`×`) 지원
- **읽기 전용 메타데이터**:
  - **품질 점수**: 0~100점 점수 및 상태 배지(우수/양호/검토 필요)
  - **원본 파일명 / 수집 일시**: 원본 추적성 제공
- 변경 시 500ms 디바운스로 마크다운 파일의 YAML Frontmatter 영역을 안전하게 갱신하고 SQLite DB를 업데이트합니다.

### ③ 좌우 원본 비교 분할 뷰 (`CompareSplitView.tsx`)
- **좌측: 원본 문서 뷰어 (Original File Viewer)**:
  - **PDF (`.pdf`)**: Electron 안전 URL 및 `<iframe>` 기반 내장 PDF 뷰어로 원본 문서 페이지 단위 열람
  - **이미지 (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)**: Data URI 기반 고해상도 원본 이미지 미리보기
  - **HTML (`.html`, `.htm`)**: `sandbox`가 적용된 안전한 `<iframe>`으로 원본 웹페이지 레이아웃 렌더링
  - **Office 문서 (`.docx`, `.pptx`, `.xlsx` 등)**: 파일 형식 아이콘 및 정보 카드와 함께 `[기본 프로그램으로 원본 열기]` 버튼 제공 (`shell.openPath` 연동)
- **우측: 변환된 마크다운 미리보기 (Converted Markdown)**:
  - 원본과 대조하며 추출된 제목, 본문, 표, 서식이 정상적인지 한눈에 검토 가능

### ④ 서식 툴바 & 자동 저장을 갖춘 마크다운 편집기 (`MarkdownEditor.tsx`)
- **서식 도구 모음 (Formatting Toolbar)**:
  - 제목 (`H1`, `H2`, `H3`), 굵게(`**B**`), 기울임(`*I*`), 글머리 기호(`-`), 번호 매기기(`1.`), 인용구(`>`), 코드 블록(` ``` `), 표(`|`) 원클릭 삽입
  - 선택 영역이 있을 경우 해당 텍스트를 감싸서 서식 적용
- **스마트 자동 저장 (Auto-save)**:
  - 타이핑 중 2초간 입력이 멈추면 자동으로 디스크(`Library/...md`) 및 SQLite DB에 저장
  - 우측 하단 상태 배지에 `저장 중...` 및 `저장됨 ✓` 실시간 표시
  - `Ctrl+S` (또는 `Cmd+S`) 입력 시 즉시 수동 저장 지원
- **문서 내 검색 (In-document Search)**:
  - `Ctrl+F` 단축키로 검색 바 토글
  - 실시간 매칭 개수(`N / M`) 노출 및 `[이전]` / `[다음]` 버튼으로 검색 결과 순회
- **실시간 통계**:
  - 본문 글자 수(공백 제외 포함) 및 단어 수 실시간 계산 표시

### ⑤ 안전한 재변환 (Safe Reconversion with History Backup, `ReconvertModal.tsx`)
- 변환 품질이 만족스럽지 않거나 수동 편집 중 이전 버전으로 되돌리고 싶을 때 활용
- **히스토리 스냅샷 백업**:
  - 재변환 실행 직전 현재 마크다운 파일의 상태를 `Library/.history/<slug>.<timestamp>.md`에 영구 보존
- **프로필 선택**:
  - `균형 모드`, `빠름 모드`, `최고 품질 모드 (OCR/Vision)` 중 선택하여 파이썬 사이드카 재변환 요청
  - 변환 완료 후 새로운 마크다운 본문 및 품질 점수를 DB에 즉시 반영

---

## 2. 변경된 파일 목록

| 영역 | 파일 경로 | 주요 작업 내용 |
|---|---|---|
| **DB & IPC** | `apps/desktop/src/main/db.ts` | `updateConversion(id, updates)` 추가 (마크다운, 제목, 상태, 프로필, 점수 등 수정) |
| **Main Process** | `apps/desktop/src/main/index.ts` | `shell:open-path`, `library:save-markdown`, `library:backup-and-reconvert`, `library:read-original-file-url` IPC 핸들러 등록 |
| **Preload** | `apps/desktop/src/preload/index.ts`<br>`apps/desktop/src/preload/index.d.ts` | 렌더러용 `openPath`, `saveMarkdown`, `backupAndReconvert`, `getOriginalFileUrl` 안전 브릿지 노출 |
| **UI Components** | `apps/desktop/src/renderer/src/components/DetailViewer.tsx` | 상세 보기 최상위 컨테이너, 3탭 스위처, 액션 바, 키보드 단축키 연동 |
| **UI Components** | `apps/desktop/src/renderer/src/components/CompareSplitView.tsx` | 좌측 원본 뷰어(PDF/이미지/HTML/Office) vs 우측 마크다운 비교 분할 뷰 |
| **UI Components** | `apps/desktop/src/renderer/src/components/MarkdownEditor.tsx` | 서식 툴바, 디바운스 자동 저장, Ctrl+S, Ctrl+F 문서 내 검색 기능 |
| **UI Components** | `apps/desktop/src/renderer/src/components/FrontmatterForm.tsx` | 접이식 속성 패널, 제목/상태/카테고리/태그 편집 및 마크다운 YAML 동기화 |
| **UI Components** | `apps/desktop/src/renderer/src/components/ReconvertModal.tsx` | 프로필 선택기 및 히스토리 스냅샷 백업 안내 모달 |
| **App & History** | `apps/desktop/src/renderer/src/App.tsx`<br>`apps/desktop/src/renderer/src/components/HistorySection.tsx` | 수집함 더블클릭/상세 버튼 클릭 시 상세 모드 전환 및 ESC 복귀 연결 |

---

## 3. 검증 결과

1. **테스트 스위트 검증**:
   - `pnpm test:all` 통과 (Vitest 2개 테스트 + pytest 골든셋 5개 테스트 전체 통과)
2. **프로덕션 빌드 검증**:
   - `pnpm build` 통과 (`electron-vite build` 완료: main, preload, renderer 번들 에러 0건)
3. **사용자 경험(UX) 원칙 준수**:
   - Things 3 스타일의 차분한 블루 포인트(`--color-primary`) 및 절제된 모달/토스트 안내
   - 불필요한 알럿창 없이 자동 저장 및 스냅샷 백업을 통한 데이터 유실 방지
