# Phase 1 완료 보고서: 프로젝트 뼈대 및 사이드카 연결

이 문서는 MarkFlow 프로젝트의 첫 화면 뼈대(Electron + React)와 Python 변환 엔진(FastAPI + MarkItDown) 간의 연결 및 프로세스 관리 구현 결과를 정리한 문서입니다.

---

## 1. 무엇을 만들었는가?

### ① 데스크톱 앱 뼈대 (`apps/desktop`)
- **Electron + Vite + React + TypeScript** 기반 모던 데스크톱 셸 구축
- **Things 스타일 2영역(Two-Pane) UI 레이아웃**:
  - **왼쪽 사이드바**:
    - 상단 고정 메뉴: 수집함(Inbox) · 오늘(Today) · 검토 필요 · 라이브러리 · 기록(Logbook)
    - 중단: 영역(Area) > 프로젝트(Project) 2단계 계층 슬롯 (`업무 > AX 추진, B.Argos`, `개인`)
    - 하단: 스마트 그룹, 태그, 맨 아래 엔진 상태 표시 점(●) 및 라이트/다크 테마 토글 버튼
  - **오른쪽 본문**:
    - Things 스타일 헤더: 큰 제목(`수집함`) + 짧은 설명 한 줄(`새로 들어온 문서를 분류하세요`)
    - 깔끔한 빈 화면(Empty State)과 우측 하단 플로팅 액션 버튼 `(+)`
- **디자인 토큰 시스템**:
  - `src/renderer/src/tokens/design-tokens.ts`: 색상, 글꼴(Pretendard), 8px 그리드 간격, 8~10px 라운딩, 150~200ms 부드러운 애니메이션 정의
  - `docs/design-system.md` 및 `docs/ui-checklist.md` 문서화 완료

### ② Python 변환 엔진 사이드카 (`engine`)
- **Python 3.12 + uv** 기반의 FastAPI 서비스 구축
- `GET /health` 엔드포인트:
  - 엔진 버전(`0.1.0`) 및 Microsoft `markitdown` 버전(`0.1.8`)을 실시간 반환
- `pytest` 기반 자동화 검증 완료

### ③ 똑똑한 사이드카 프로세스 관리 (`SidecarManager`)
- **충돌 없는 동적 포트**: Node.js `net` 모듈로 OS가 비어 있는 안전한 랜덤 포트(예: `61346`)를 찾아 바인딩
- **헬스체크 및 준비 대기**: 최대 15초 동안 500ms 간격으로 엔진 헬스체크를 수행하여 연결 성공 시 렌더러에 즉시 반영
- **Windows 좀비 프로세스 방지**: 앱 종료 시 `taskkill /pid <PID> /T /F`로 하위 Python 프로세스 트리를 강제 정리하여 백그라운드에 프로세스가 남지 않음
- **1회 자동 재시작**: 비정상 종료 시 1회 자동 재시작 시도

---

## 2. 사용자가 직접 확인하는 방법

### 1단계: 개발 모드 실행
Antigravity IDE 하단 터미널에서 다음 명령을 입력합니다:
```bash
pnpm dev
```

### 2단계: 화면 확인
1. 깔끔한 흰색 바탕(라이트 모드)의 MarkFlow 창이 열립니다.
2. 왼쪽 사이드바 맨 아래 작은 점이 **초록색(●)**으로 빛납니다.
3. 초록색 점 위에 마우스를 올리면 툴팁이 나타납니다:
   - **변환 엔진 정상 작동 중**
   - **포트:** `XXXXX (127.0.0.1)`
   - **MarkItDown:** `v0.1.8`
4. 사이드바 오른쪽 아래 달(Moon) 아이콘을 누르면 세련된 다크 모드로 전환됩니다.

### 3단계: 프로세스 종료 확인
1. 앱 창의 `X` 버튼을 눌러 앱을 닫습니다.
2. Windows 작업 관리자(Ctrl+Shift+Esc)의 세부 정보 탭에서 잔류 중인 `uvicorn` 또는 불필요한 Python 프로세스가 완전히 사라졌는지 확인합니다.

---

## 3. 테스트 및 검증 결과 요약

- [x] **Desktop Vitest 단위 테스트**: `2/2 passed` (토큰 및 애니메이션 규격 검증)
- [x] **Engine Pytest 단위 테스트**: `1/1 passed` (`/health` 엔드포인트 정상 응답)
- [x] **통합 빌드 검증**: `electron-vite build` 오류 없이 완료 (`out/main`, `out/preload`, `out/renderer`)
- [x] **실시간 동적 포트 통신**: `Invoke-RestMethod` 실측 결과 `{status: "ok", version: "0.1.0", markitdown_version: "0.1.8"}` 정상 반환
- [x] **종료 후 포트 및 프로세스 정리**: 정상 확인 완료
