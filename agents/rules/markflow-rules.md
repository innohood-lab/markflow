# MarkFlow 프로젝트 규칙 (Workspace Rule — 항상 적용)

> 이 파일은 `.agents/rules/markflow-rules.md` 위치에 둔다. 모든 작업에서 이 규칙을 우선 따른다.

## 1. 제품 정의
- 앱 이름: MarkFlow (가칭)
- 목적: Office(DOCX·PPTX·XLSX)·HTML·이미지·PDF 문서를 고품질 Markdown(MD)으로 변환하고, 변환 결과를 GitHub LLM-wiki / iCloud Obsidian 볼트로 내보내며, MD 파일을 노션형 보드로 관리하는 개인용 데스크톱 앱
- 클라우드 저장소(Google Drive·OneDrive·Dropbox·iCloud Drive)를 변환 원본 가져오기(Source)와 변환 결과 저장(Destination) 양쪽으로 연결함
- 최종 지향점: DEVONthink처럼 문서 수집·변환·분류·연결·검색을 한곳에서 하는 종합 문서·개인 지식 관리(PKM) 앱. 화면과 조작감은 Things처럼 직관적이고 간결하게(8장)
- 대상 OS: macOS(Apple Silicon) + Windows 11 — 두 OS에서 동일하게 동작해야 함
- 사용자: 개발 비전공 팀장 1인. 개인 PC에서만 사용(서버 없음)

## 2. 기술 스택 (변경 금지 — 바꿔야 할 이유가 생기면 먼저 사용자에게 묻는다)
- 데스크톱 셸: Electron + electron-vite + React + TypeScript
- UI: Tailwind CSS + shadcn/ui, 아이콘 lucide-react
- 변환 엔진: Python 3.12 사이드카(sidecar) 프로세스 — FastAPI + uvicorn, `127.0.0.1` 랜덤 포트에서만 수신
  - 핵심 모듈: `markitdown[all]` (Microsoft) + `markitdown-ocr` 플러그인
  - Python 패키지 관리: uv
  - 로컬 임베딩(관련 문서·분류 제안): ONNX 기반 다국어 소형 모델 + sqlite-vec — 외부 전송 없음
- 로컬 DB: SQLite (better-sqlite3) — 보드 색인·검색(FTS5)·변환 이력용 "캐시". 원본 데이터는 항상 MD 파일
- MD 편집기: Milkdown (Crepe) — Markdown 원문을 그대로 보존하는 편집기
- 비밀값 저장: Electron `safeStorage`(OS 키체인 암호화). 평문 저장 절대 금지
- 패키징: Python은 PyInstaller(onedir), 앱은 electron-builder(mac `.dmg`, win NSIS `.exe`), 빌드는 GitHub Actions 매트릭스(macos-latest, windows-latest)

## 3. 폴더 구조
```
markflow/
├─ apps/desktop/          # Electron + React
│  ├─ src/main/           # 메인 프로세스(파일·키체인·사이드카 관리·GitHub/Obsidian 내보내기)
│  ├─ src/preload/        # contextBridge로 안전한 API만 노출
│  └─ src/renderer/       # React 화면
├─ engine/                # Python 변환 엔진(사이드카)
│  ├─ markflow_engine/
│  │  ├─ api.py           # FastAPI 엔드포인트
│  │  ├─ pipeline/        # preprocess → convert → postprocess → quality
│  │  └─ exporters/       # (필요 시) 파이썬 측 보조 로직
│  └─ tests/golden/       # 골든셋(샘플 원본 + 기대 결과)
├─ samples/               # 사용자가 넣는 테스트 원본 문서
├─ docs/                  # 설계 문서, 결정 기록(ADR), 단계별 walkthrough
└─ .github/workflows/     # 크로스 OS 빌드
```

## 4. 앱 데이터 위치
- 라이브러리(원본 MD 보관소) 기본값: mac `~/Documents/MarkFlow/Library`, win `%USERPROFILE%\Documents\MarkFlow\Library` — 설정에서 변경 가능
- 문서 1건 = `Library/<slug>.md` + 첨부 이미지 `Library/assets/<slug>/`
- 앱 설정·DB: Electron `app.getPath('userData')`
- 경로는 반드시 `path.join`/`pathlib` 사용. 하드코딩 금지, 한글·공백 경로 지원 필수

## 5. MD 파일 표준 (모든 변환 결과에 적용)
- 맨 위 YAML frontmatter 필수:
  ```yaml
  ---
  title: 문서 제목
  source_file: 원본파일명.pptx
  source_type: pptx
  converted_at: 2026-10-17T18:00:00+09:00
  engine: markitdown 0.x.x (+ocr, +llm)
  quality_score: 0~100
  status: 미분류        # 보드 상태값: 미분류/검토중/완료/보관
  tags: []
  groups: []          # 영역/프로젝트 (여러 개 가능)
  category: ""
  source_location: ""  # 클라우드 원본이면 "Google Drive:/경로/파일명"
  exported: { github: false, obsidian: false, gdrive: false, onedrive: false, dropbox: false, icloud: false }
  ---
  ```
- 이미지 링크는 상대경로 `assets/<slug>/img-001.png`
- 인코딩 UTF-8, 줄바꿈 LF

## 5-1. 클라우드 저장소 연결 원칙
- 모든 클라우드는 "저장소 어댑터(StorageAdapter)" 공통 인터페이스로 다룬다: `list`, `read`(로컬 임시파일로 내려받기), `write`, `exists`, `watch`(가능한 경우)
- 연결 방식 2단계
  - 기본: 동기화 폴더 방식 — PC에 설치된 각 클라우드 동기화 앱의 로컬 폴더를 자동 감지해 일반 폴더처럼 읽고 씀 (4종 모두, iCloud는 이 방식만)
  - 보조: API 방식 — 동기화 앱이 없는 PC용. Google Drive API, Microsoft Graph(OneDrive), Dropbox API를 OAuth 2.0(PKCE + 127.0.0.1 루프백)으로 연결
- 원본 파일은 절대 수정·이동·삭제하지 않는다(읽기 전용 취급). 쓰기는 사용자가 지정한 저장 대상 폴더에만
- "온라인 전용" 파일(Files On-Demand, iCloud `.icloud` 자리표시 파일)은 다운로드를 끝낸 뒤 변환한다
- SQLite DB는 클라우드 폴더에 두지 않는다(동기화 충돌·손상 방지). 항상 userData에

## 6. 보안·비용 원칙 (절대 규칙)
- 비용 0원: 유료 API 기본 사용 금지. Azure Document Intelligence 등 유료 기능은 코드에 넣되 기본 OFF
- LLM(이미지 설명·OCR)은 OpenAI 호환 클라이언트로 연결, 기본 공급자는 Gemini 무료 API(OpenAI 호환 엔드포인트). 로컬 LLM(OpenAI 호환 `http://localhost:1234/v1`)도 선택 가능하게
- LLM 사용은 기본 OFF. 켤 때 "문서 내용이 외부로 전송됨" 경고를 보여준다. 문서별로 끌 수 있어야 한다
- 텔레메트리·외부 전송 금지(LLM 호출, GitHub 업로드 제외)
- Electron 보안: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. 렌더러는 preload API만 사용
- 토큰·API 키를 로그·에러 메시지·커밋에 절대 남기지 않는다
- 클라우드 OAuth 토큰(액세스·리프레시)도 safeStorage로만 저장. OAuth 권한 범위(scope)는 필요한 최소한으로

## 8. UI·인터랙션 원칙 — Things 스타일 (모든 화면에 적용)
- 지향점: Things처럼 직관적이고 간결함. 단, Things의 아이콘·로고·고유 그래픽은 복제하지 않고 "원칙"만 따른 독자 디자인으로
- 화면 구조: 왼쪽 사이드바 + 오른쪽 본문, 딱 2영역. 상단 툴바·리본·탭 남발 금지
  - 사이드바 상단(고정): 수집함(Inbox) · 오늘(Today) · 검토 필요 · 라이브러리 · 기록(Logbook)
  - 사이드바 중단: 영역(Area) > 프로젝트(Project) 2단 계층 — 문서를 묶는 그룹
  - 사이드바 하단: 스마트 그룹, 태그, 맨 아래 작은 엔진 상태 점·설정 톱니
- 한 화면 = 한 가지 일. 본문 상단은 큰 제목 + 짧은 설명 한 줄, 그 아래 목록
- 시각: 흰 배경(다크모드 지원), 강조색 1개(차분한 파랑), 회색 단계로 위계 표현, 테두리 대신 여백, 8px 그리드, 둥근 모서리 8~10px, 그림자는 떠 있는 요소에만 아주 약하게
- 글꼴: 영문 시스템 폰트(SF Pro / Segoe UI), 한글 Pretendard. 본문 14~15px, 제목 26~28px Bold
- 움직임: 150~200ms 부드러운 전환. 항목 완료·이동 시 짧은 애니메이션. 과한 효과 금지
- 인터랙션
  - 확인 창 대신 "되돌리기(Cmd/Ctrl+Z)" + 하단 토스트 — 삭제도 휴지통 이동 + 되돌리기
  - 제자리 편집: 제목·태그는 클릭해서 바로 수정
  - 드래그 앤 드롭: 문서를 사이드바 프로젝트·태그로 끌어 놓으면 분류 완료
  - 빠른 입력(Quick Entry): 앱 밖에서도 전역 단축키로 작은 입력창을 띄워 파일·URL·메모를 즉시 수집함에 넣음
  - 바로 이동(Type Travel): 아무 화면에서나 글자를 치기 시작하면 문서·프로젝트·태그로 이동하는 검색창이 뜸 (Cmd/Ctrl+K도 동일)
  - 떠 있는 [+] 버튼: 현재 화면 맥락에 맞는 새 항목 추가
  - 모든 주요 동작에 단축키, 단축키 목록은 Cmd/Ctrl+/ 로 표시
  - 빈 화면(Empty state)에는 다음 행동을 알려주는 한 줄 안내 + 일러스트 대신 큰 아이콘 하나
- 매 화면 Phase 종료 시 docs/ui-checklist.md 항목으로 자체 점검하고 스크린샷을 walkthrough에 첨부

## 7. 작업 방식
- 각 Phase는 반드시 Implementation Plan을 먼저 작성해 사용자 승인을 받은 뒤 구현한다
- 한 번에 한 Phase만. 범위 밖 기능을 미리 만들지 않는다
- 모든 Phase 끝에 다음을 수행한다
  1. 테스트 실행(Python: pytest, TS: vitest) — 실패 0건
  2. 실제 앱을 띄워 브라우저/스크린샷으로 동작 확인
  3. `docs/walkthrough/phase-N.md`에 "무엇을 만들었고, 사용자가 어떻게 확인하는지"를 비개발자용 한국어로 작성
  4. git 커밋 (메시지: `feat(phase-N): 요약`)
- 사용자에게 설명할 때는 개발 용어를 쉬운 말로 풀어서 한국어로 설명한다. 사용자가 직접 해야 하는 일(설치·클릭·입력)은 번호를 붙여 단계별로 쓴다
- 라이브러리 API가 확실하지 않으면 추측하지 말고 설치된 패키지 소스나 공식 문서를 먼저 확인한다
- macOS·Windows 양쪽에서 깨질 수 있는 코드(경로, 줄바꿈, 셸 명령, 파일 잠금)는 작성 시점에 양쪽을 모두 고려한다
