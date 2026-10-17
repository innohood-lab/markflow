# MarkFlow 보안 아키텍처 및 체크리스트 (Security Checklist)

본 문서는 **MarkFlow** 데스크톱 지식 보관소의 보안 원칙, Electron 메인/렌더러 격리 구조, Python Sidecar 인증 및 토큰 보호 메커니즘을 정의합니다.

---

## 1. Electron 렌더러 격리 및 브라우저 보안

MarkFlow는 공격 표면(Attack Surface)을 최소화하기 위해 Electron 표준 보안 가이드라인을 엄격히 준수합니다.

| 항목 | 설정값 | 보안 목적 |
| :--- | :--- | :--- |
| **`nodeIntegration`** | `false` | 렌더러 프로세스에서 임의의 Node.js 네이티브 API 직접 실행 차단 |
| **`contextIsolation`** | `true` | Preload 스크립트의 실행 컨텍스트와 렌더러 DOM 컨텍스트를 완전 격리 |
| **`sandbox`** | `true` | OS 수준의 Chromium 샌드박스를 적용하여 파일 시스템 직접 접근 통제 |
| **`contextBridge`** | 적용 | `window.markflowApi` 화이트리스트 객체만 선별 노출 |
| **웹뷰 및 원격 로딩** | 비활성화 | 임의 외부 URL 로드 차단, 로컬 번들 파일만 서빙 |

---

## 2. Python Sidecar 프로세스 간 통신(IPC) 보안

변환 엔진(MarkItDown)을 구동하는 Python FastAPI 사이드카는 로컬 루프백 인터페이스와 동적 암호화 토큰으로 보호됩니다.

```
+---------------------+                      +---------------------+
|                     |  X-Engine-Secret     |                     |
|  Electron Main      | -------------------> |  Python Sidecar     |
|  Process            | <------------------- |  (FastAPI / Uvicorn)|
|                     |      HTTP JSON       |                     |
+---------------------+                      +---------------------+
           |                                            |
   crypto.randomBytes(32)                      127.0.0.1:DynamicPort
```

1. **로컬 루프백 한정 바인딩 (`127.0.0.1`):**
   - 사이드카 프로세스는 `0.0.0.0`이 아닌 `127.0.0.1`에만 바인딩되며, 외부 네트워크 인터페이스로의 노출이 원천 차단됩니다.
2. **동적 포트 할당:**
   - 고정 포트 충돌 및 타 프로세스의 포트 점유 스캐닝을 방지하기 위해 빈 임의 포트를 동적으로 탐색하여 바인딩합니다.
3. **`X-Engine-Secret` 공유 비밀 토큰 인증:**
   - Electron 메인 프로세스가 부팅 시 `crypto.randomBytes(32).toString('hex')`로 64자리 일회용 비밀 토큰을 생성합니다.
   - 사이드카 구동 시 환경 변수 `MARKFLOW_ENGINE_SECRET`으로 주입합니다.
   - Python FastAPI의 `verify_engine_secret_middleware`가 `/health`를 제외한 모든 엔드포인트(`/convert`, `/similarity/recommendations` 등)의 `X-Engine-Secret` 헤더를 검증합니다. 일치하지 않는 요청은 `403 Forbidden`으로 즉각 거절됩니다.

---

## 3. 민감 자격 증명(PAT 및 API Key) 암호화 저장

외부 연동을 위한 자격 증명(GitHub Personal Access Token, OpenAI/Anthropic/Gemini API Key)은 플레인텍스트로 저장되지 않습니다.

1. **Electron `safeStorage` (OS 네이티브 암호화):**
   - **Windows:** DPAPI (Data Protection API) 암호화 사용
   - **macOS:** Keychain 암호화 사용
   - **Linux:** Secret Service API 또는 GNOME Keyring 사용
2. **렌더러 화면 마스킹 (Masking on Presentation):**
   - 메인 프로세스에서 렌더러로 설정을 전달할 때 항상 앞/뒤 4자리만 남기고 마스킹 처리 (`ghp_••••••••••••cdef`, `sk-••••••••••••cdef`)합니다.
   - 평문 토큰은 사용자가 입력/수정하는 시점에만 일시적으로 메인 프로세스에 전송되어 즉시 암호화됩니다.
3. **토큰 완전 삭제 (Zeroization):**
   - 환경설정 화면의 "토큰 완전 삭제" 기능을 통해 저장된 DPAPI 암호화 블록을 즉시 초기화할 수 있습니다.

---

## 4. 로그 파일 보호 및 개인정보 자동 마스킹

`LoggerService`는 문제 진단을 위해 일 단위 회전 로그(`markflow-YYYY-MM-DD.log`)를 기록합니다.

1. **자동 정규식 마스킹 (Mask Sensitive Data):**
   - GitHub PAT (`ghp_[a-zA-Z0-9]{36}`) $\rightarrow$ `ghp_****`
   - Fine-grained / OAuth GitHub 토큰 $\rightarrow$ `github_pat_****`, `gh*k_****`
   - OpenAI / Anthropic API Key (`sk-[a-zA-Z0-9_\-]{20,}`) $\rightarrow$ `sk-****`
   - Google Gemini API Key (`AIzaSy...`) $\rightarrow$ `AIzaSy****`
   - HTTP Bearer 인증 헤더 (`Bearer ...`) $\rightarrow$ `Bearer ****`
   - JSON 및 Query 내 `apiKey`, `secret`, `password` 필드 자동 마스킹
2. **보관 주기 자동 삭제 (Log Retention):**
   - 앱 구동 시 생성된 지 7일이 지난 오래된 로그 파일은 자동으로 영구 삭제됩니다.

---

## 5. 파일 시스템 격리 및 경로 탐색(Path Traversal) 방지

1. **보관함 디렉터리 정규화:**
   - 모든 마크다운 저장 및 자산 복사는 `path.resolve` 및 `path.normalize`를 거치며, 상위 디렉터리 탈출(`../`)을 검증합니다.
2. **단축키 및 백그라운드 캡처 무결성:**
   - 빠른 메모 및 템플릿 생성 시 자동 슬러그 생성(`slugify`)을 통해 안전한 파일명만 생성합니다.

---

## 6. 보안 검증 체크리스트

| 검증 항목 | 상태 | 확인 방식 |
| :--- | :---: | :--- |
| `nodeIntegration: false`, `contextIsolation: true` 적용 | ✅ 통과 | `apps/desktop/src/main/index.ts` createWindow 옵션 |
| Sidecar `X-Engine-Secret` 헤더 미포함 요청 차단 | ✅ 통과 | `engine/tests/test_auth.py` 테스트 (403 검증) |
| Sidecar 유효 `X-Engine-Secret` 요청 승인 | ✅ 통과 | `engine/tests/test_auth.py` 테스트 (200 검증) |
| GitHub PAT 및 LLM API 키 `safeStorage` 암호화 | ✅ 통과 | `settingsService.ts` encryptSecret/decryptSecret |
| 렌더러 화면에 마스킹된 토큰만 전달 | ✅ 통과 | `loadSettings(false)`의 `maskedPat`, `maskedLlmApiKey` |
| 로그 파일 내 PAT / API 키 패턴 자동 마스킹 | ✅ 통과 | `loggerService.ts` maskSensitiveData 단위 테스트 |
| 7일 초과 로그 파일 자동 순환 삭제 | ✅ 통과 | `logger.cleanOldLogs(7)` 단위 테스트 |
| 클라우드 폴더 및 토큰 원클릭 완전 삭제 지원 | ✅ 통과 | SettingsModal `handleClearTokens` |
