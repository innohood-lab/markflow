# Phase 9: 설정 · 보안 · 안정성 마무리 워크스루 (Walkthrough)

## 1. 구현 개요

Phase 9에서는 MarkFlow의 **보안 무결성**, **환경설정 5대 탭 통합**, **장애 진단 및 민감 정보 마스킹 로깅**, **최초 실행 온보딩 위저드**를 완성하였습니다.

---

## 2. 주요 구현 내용

### 1) Python Sidecar 프로세스 간 통신(IPC) 보안 인증
- **동적 시크릿 생성:** Electron 메인 프로세스(`SidecarManager`) 기동 시 `crypto.randomBytes(32).toString('hex')`로 64자리 일회용 토큰을 생성.
- **환경 변수 주입:** 사이드카 자식 프로세스 실행 시 `MARKFLOW_ENGINE_SECRET` 환경 변수로 안전하게 전달.
- **FastAPI 인증 미들웨어:** `engine/src/markflow_engine/api.py`에 `verify_engine_secret_middleware` 추가.
  - 헬스 체크(`/health`)는 차단 없이 통과.
  - 변환(`/convert`) 및 유사도 제안(`/similarity/recommendations`) 요청 시 `X-Engine-Secret` 헤더 검증, 불일치 시 `403 Forbidden` 반환.
- **Node.js 클라이언트 헤더 부착:** `SidecarManager.convertDocument()` 및 `aiRecommendationService.getRecommendations()`에서 `X-Engine-Secret` 헤더 자동 첨부.

### 2) LoggerService 및 민감 정보 자동 마스킹
- **파일 경로:** `apps/desktop/src/main/services/loggerService.ts`
- **일 단위 회전 로그:** `app.getPath('userData')/logs/markflow-YYYY-MM-DD.log`
- **정규식 기반 민감 데이터 자동 마스킹 (`maskSensitiveData`):**
  - GitHub Classic PAT (`ghp_[a-zA-Z0-9]{20,}`) $\rightarrow$ `ghp_****`
  - GitHub Fine-grained PAT (`github_pat_*`) $\rightarrow$ `github_pat_****`
  - OpenAI / Anthropic 키 (`sk-[a-zA-Z0-9_\-]{20,}`) $\rightarrow$ `sk-****`
  - Google Gemini 키 (`AIzaSy...`) $\rightarrow$ `AIzaSy****`
  - HTTP `Authorization: Bearer ...` $\rightarrow$ `Bearer ****`
  - JSON 내 `apiKey`, `password`, `secret`, `token` 속성값 자동 마스킹
- **7일 보관 주기 자동 삭제:** `cleanOldLogs(7)`를 통해 앱 시작 시 7일이 지난 오래된 로그 파일 자동 정리.
- **시스템 탐색기 열기:** IPC `logger:open-folder`로 사용자가 원클릭으로 로그 디렉터리를 열 수 있도록 지원.

### 3) 설정 화면 5대 탭 통합 (`SettingsModal.tsx`)
1. **일반 (General):**
   - 기본 마크다운 보관함(Library) 경로 표시 및 `pickLibraryFolder` 다이얼로그 연동.
   - 인터페이스 언어 선택 (한국어 / English).
   - 화면 테마 설정 (라이트 / 다크 / 시스템).
2. **변환 & AI (Conversion & AI):**
   - 기본 품질 프로필 선택: Balanced (균형, 기본 권장) / Fast (고속) / Best Quality (최고 품질).
   - 동시 변환 작업 수 (Concurrency): 1 ~ 5 선택.
   - 외부 LLM 보강 연동: None, OpenAI, Anthropic, Google Gemini, Ollama 선택.
   - 모델명 입력 및 API 키 `safeStorage` 분리 암호화 저장 및 렌더러 마스킹 표시.
3. **내보내기 (Export):**
   - GitHub LLM-wiki 내보내기 설정 (저장소/브랜치/경로, PAT 마스킹 입력, 연결 테스트).
   - Obsidian 보관함 동기화 설정 (볼트 경로 선택 및 `.obsidian` 감지 피드백).
   - 자동 내보내기 (Auto-Export) 활성화 및 대상 (GitHub만 / Obsidian만 / 둘 다 동시) 설정.
4. **클라우드 & 감시 (Cloud & Watch Folders):**
   - 로컬 시스템에 설치된 클라우드 드라이브 자동 감지 목록 표시.
   - 사용자 감시 폴더(Watch Folders) 추가, 활성화 토글, 삭제.
   - 보안 및 자격 증명 초기화 ("토큰 완전 삭제" 원클릭 초기화).
5. **정보 & 진단 (About & Diagnostics):**
   - 데스크톱 앱 버전 (`v0.1.0 PKM Edition`).
   - Python 사이드카 엔진 상태, MarkItDown 버전, 로컬 격리 포트(127.0.0.1:동적포트), 엔진 재시작 버튼.
   - 진단 로그 폴더 열기 버튼.
   - 오픈소스 MIT 라이선스 및 GitHub 저장소 링크.

### 4) 최초 실행 온보딩 위저드 (`OnboardingModal.tsx`)
- `localStorage.getItem('markflow_onboarding_completed')`를 기반으로 최초 실행 시 자동 팝업.
- 4단계 위저드:
  1. 환영 및 기본 마크다운 보관함 위치 확인/변경.
  2. 로컬 클라우드 드라이브 자동 감지 결과 안내.
  3. 지식 저장소 연동 방식 (GitHub & Obsidian 동시 / 로컬 단독) 선택.
  4. 준비 완료 및 필수 단축키 치트시트 안내 (`Ctrl+K`, `Ctrl+Shift+Space`, `Ctrl+N`, `?`).

### 5) 보안 체크리스트 문서화
- `docs/security-checklist.md`: Electron 프로세스 격리 원칙, 사이드카 통신 보안, safeStorage 암호화, 로그 마스킹 원칙 체계화.

---

## 3. 테스트 및 검증 결과

- **Vitest 데스크톱 단위 테스트:** 9개 테스트 스위트 전체 62개 테스트 통과
  ```
  Test Files  9 passed (9)
  Tests       62 passed (62)
  Duration    802ms
  ```
- **Pytest 사이드카 엔진 테스트:** 11개 테스트 통과 (Sidecar Token 인증 테스트 포함)
  ```
  11 passed, 1 warning in 1.97s
  ```
- **Electron-Vite 프로덕션 빌드:** 에러 없이 빌드 성공
  ```
  out/main/index.js      437.33 kB
  out/preload/index.js   6.50 kB
  out/renderer/...       652.25 kB
  ```
