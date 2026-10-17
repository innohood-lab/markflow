# Phase 2 완료 보고서: 기본 변환 v1 및 수집함 좌우 2분할 화면

이 문서는 MarkFlow 프로젝트의 핵심 기능인 **로컬 파일 마크다운 변환 파이프라인(Phase 2)**과 **수집함(Inbox) 좌우 2분할 드래그 앤 드롭 및 변환 내역 관리 화면** 구현 결과를 정리한 문서입니다.

---

## 1. 무엇을 만들었는가?

### ① Python 변환 엔진 파이프라인 (`engine/src/markflow_engine/converter.py`)
- **16개 포맷 변환 지원**:
  - 오피스: `.docx`, `.pptx`, `.xlsx`, `.csv`
  - 문서: `.pdf`, `.html`, `.txt`, `.json`, `.xml`, `.rss`, `.atom`
  - 이미지: `.png`, `.jpg`, `.jpeg`
  - 오디오: `.mp3`, `.wav`
- **미지원 포맷 안전 처리**: `.hwp`, `.exe` 등 미지원 파일 입력 시 프로세스 중단 없이 친절한 안내 메시지(`MarkFlow에서 현재 지원하지 않는 포맷입니다`) 반환.
- **슬러그 및 중복 파일 방지**:
  - 한글 제목(`2026_신제품_기획안`) 및 영숫자 슬러그 보존
  - 동일 파일명 재변환 시 덮어쓰지 않고 `<slug>-2.md`, `<slug>-3.md` 자동 순번 부여
- **Rule 5 준수 YAML Frontmatter 자동 생성**:
  - `title`, `source_path`, `source_type`, `created_at`, `tags: [unprocessed]`, `status: inbox`, `quality_score: 85` 등 메타데이터 규격 완전 준수
- **라이브러리 자동 저장**:
  - 기본 경로 `~/Documents/MarkFlow/Library/<slug>.md`로 즉시 기록 및 UTF-8 저장

### ② REST API 확장 (`engine/src/markflow_engine/api.py`)
- `POST /convert`:
  - 요청: `{"file_path": "C:/...", "auto_save": true}`
  - 응답: `{"markdown": "...", "frontmatter": {...}, "output_path": "...", "format": "pdf", "execution_time_ms": 284}`

### ③ 데스크톱 로컬 SQLite DB (`apps/desktop/src/main/db.ts`)
- **Electron ABI 132 호환 `better-sqlite3`**:
  - Windows x64 환경에서 node-gyp 컴파일 부담 없이 구동되도록 Electron 34 전용 공식 바이너리 완벽 통합
- **테이블 스키마**:
  - `conversions`: `id`, `source_path`, `output_path`, `format`, `title`, `status`, `quality_score`, `created_at`, `deleted_at`
- **안전한 CRUD & Soft Delete**:
  - 파일 삭제 시 즉시 파괴하지 않고 휴지통(`shell.trashItem`) 이동 및 DB soft delete(`deleted_at`), 6초 실행 취소(Undo) 지원

### ④ 수집함 좌우 2분할 UI (`apps/desktop/src/renderer/src/`)
- **SplitPane (`components/SplitPane.tsx`)**:
  - 드래그로 조절 가능한 좌우 분할 패널 (기본 45:55 비율, 최소 280px 보장)
- **왼쪽: 큐 및 드롭존 (`components/QueueSection.tsx`)**:
  - 대형 드래그 앤 드롭 영역 (파일/폴더 선택 버튼 포함)
  - 확장자별 산뜻한 배지 아이콘(DOCX, PPTX, XLSX, PDF, PNG 등)
  - 실시간 상태 배지: 대기 중(회색) / 변환 중(파란색 애니메이션) / 완료(초록색) / 실패(빨간색)
  - 병렬 2개 동시 변환(Concurrency limit: 2) 큐 스케줄러 내장
  - "넣자마자 자동 변환" 토글 스위치
- **오른쪽: 변환 내역 및 마크다운 뷰어 (`components/HistorySection.tsx`, `components/MarkdownPreview.tsx`)**:
  - 실시간 검색창(파일 이름/경로 실시간 필터링)
  - 정렬 옵션(최신순, 이름순)
  - 변환 결과 선택 시 우측 하단에서 즉시 렌더링된 마크다운 및 YAML Frontmatter 박스 확인
  - 원클릭 액션 버튼: **[탐색기에서 보기]**, **[MD 복사]** (1.5초 복사 피드백), **[삭제]**
- **토스트 알림 및 실행 취소 (`components/ToastUndo.tsx`)**:
  - 삭제 시 6초간 하단에 플로팅 토스트 표시 및 **[실행 취소]** 클릭 시 DB 복구

---

## 2. 사용자가 직접 확인하는 방법

### 1단계: 개발 모드 실행
```bash
pnpm dev
```

### 2단계: 파일 드래그 앤 드롭 변환
1. 앱이 실행되면 왼쪽 수집함 영역에 점선으로 된 **"여기로 파일을 끌어다 놓으세요"** 박스가 표시됩니다.
2. `C:\markflow\samples\` 폴더를 파일 탐색기에서 엽니다.
3. 준비된 샘플 파일들(`sample.docx`, `sample.pdf`, `한글_문서.txt`, `chart.png` 등)을 수집함 영역으로 끌어다 놓습니다. (또는 **[파일 선택]** 버튼 클릭)
4. 큐에 추가되면서 **동시에 2개씩 순차적으로 변환**이 진행되며 파란색 '변환 중' 배지가 깜빡입니다.
5. 변환 완료 시 초록색 '완료' 배지로 전환됩니다.

### 3단계: 변환 결과 미리보기 및 탐색기 확인
1. 오른쪽 목록에서 변환된 항목을 클릭합니다.
2. 상단에 메타데이터(포맷, 소스 경로, 저장 경로, 품질 점수)가 담긴 YAML 박스와 함께 본문 내용이 깔끔하게 표시됩니다.
3. **[탐색기에서 보기]** 버튼을 클릭하면 실제 파일이 생성된 `내 문서\MarkFlow\Library\` 폴더가 열리며 해당 마크다운 파일이 선택됩니다.
4. **[MD 복사]** 버튼을 클릭하면 클립보드에 복사되고 "복사 완료!"로 문구가 전환됩니다.

### 4단계: 삭제 및 실행 취소(Undo) 확인
1. 목록 또는 미리보기 창의 **[삭제]** 버튼을 누릅니다.
2. 목록에서 즉시 사라지며 화면 하단에 **"파일이 삭제되었습니다 [실행 취소]"** 토스트가 6초 동안 뜹니다.
3. 6초 안에 **[실행 취소]**를 누르면 해당 항목이 목록에 복구됩니다.
4. 취소하지 않으면 실제 파일이 OS 휴지통(`shell.trashItem`)으로 안전하게 이동됩니다.

---

## 3. 테스트 및 품질 검증 결과 요약

- [x] **Desktop 단위 테스트 (`pnpm test`)**: `2/2 passed` (디자인 토큰 검증)
- [x] **Engine 단위/통합 테스트 (`cd engine && uv run pytest`)**: `4/4 passed`
  - `tests/test_health.py`: `/health` 엔드포인트 검증
  - `tests/test_convert.py`: DOCX, PDF, TXT, HWP 4종 자동 변환 및 미지원 파일 gracefully 처리 검증
- [x] **전체 테스트 통합 실행 (`pnpm test:all`)**: 전체 테스트 일괄 통과
- [x] **프로덕션 빌드 검증 (`pnpm build`)**: `electron-vite build` (Main, Preload, Renderer 번들링 0 에러)
- [x] **Electron 34 + better-sqlite3 호환성**: ABI 132 전용 네이티브 바인딩 정상 로드 및 CRUD 작동 확인 완료
