# Phase 10: 패키징 · 배포 · 릴리스 준비 워크스루 (Walkthrough)

## 1. 구현 개요

Phase 10에서는 MarkFlow의 최종 배포 산출물을 생성하기 위해 **Python Sidecar의 PyInstaller 독립 실행형 바이너리 패키징**, **`electron-builder` 기반 올인원 인스톨러 및 포터블 번들링**, **GitHub Actions 멀티 OS 릴리스 CI/CD 파이프라인**, 그리고 **사용자 설치 가이드와 마스터 README**를 구축하였습니다.

---

## 2. 주요 구현 내용

### 1) Python Sidecar 독립 실행형 바이너리 빌드 파이프라인
- **엔트리포인트:** `engine/src/markflow_engine/main.py`
  - `--port`, `--host` 인수를 파싱하여 `127.0.0.1` 루프백에서 Uvicorn 구동.
  - PyInstaller 패키징 환경을 고려한 `multiprocessing.freeze_support()` 적용.
- **PyInstaller 빌드 스크립트:** `engine/build_sidecar.py`
  - Microsoft `markitdown`, `markflow_engine`, `fastapi`, `uvicorn`, `pypdf`, `lxml` 데이터 및 히든 임포트 자동 수집.
  - 빌드 산출물: `engine/dist/engine/markflow-engine.exe` (Windows) / `markflow-engine` (macOS).
  - 단일 파일 번들 크기: 약 75.7 MB (외부 Python 없이 즉시 실행).

### 2) `electron-builder` 번들링 설정 (`apps/desktop/electron-builder.yml`)
- **ExtraResources 매핑:**
  - `engine/dist/engine` $\rightarrow$ `resources/engine`
  - 패키징된 Electron 앱 실행 시 `process.resourcesPath/engine/markflow-engine.exe` 경로로 자동 매핑되어 `SidecarManager`가 프로세스를 구동.
- **배포 타겟:**
  - **Windows:** NSIS 설치 프로그램 (`MarkFlow-Windows-0.1.0-x64.exe`) 및 포터블 무설치 버전 (`MarkFlow-Windows-Portable-0.1.0.exe`).
  - **macOS:** DMG 디스크 이미지 (`MarkFlow-macOS-0.1.0-universal.dmg`) 및 Zip 아카이브.
- **파일 연결 (File Associations):**
  - `.docx`, `.pptx`, `.xlsx`, `.pdf` (Viewer) 및 `.md` (Editor).

### 3) GitHub Actions 멀티 OS 릴리스 CI/CD (`.github/workflows/release.yml`)
- `v*.*.*` 태그 푸시 또는 `workflow_dispatch` 수동 트리거 지원.
- `windows-latest` 및 `macos-latest` 러너 매트릭스 구성:
  1. `actions/checkout@v4`
  2. Python 3.12 + Astral `uv` 환경 구성
  3. `python build_sidecar.py`로 네이티브 사이드카 바이너리 컴파일
  4. Node.js 20 + `pnpm` 환경 구성
  5. `pnpm test:all` (Vitest 62개 + Pytest 11개 단위 테스트 전체 검증)
  6. `electron-vite build` 프로덕션 번들 빌드
  7. `electron-builder` 패키징 (`.exe`, `.dmg`, `.zip`)
  8. `softprops/action-gh-release@v2`로 GitHub Releases에 자동 산출물 업로드.

### 4) 사용자 설치 가이드 및 마스터 README
- **[docs/installation-guide.md](file:///c:/markflow/docs/installation-guide.md):**
  - Windows 설치 프로그램 및 포터블 실행법, SmartScreen 경고 우회 안내.
  - macOS DMG 마운트, Applications 드래그 앤 드롭, Apple Gatekeeper (`xattr -cr`) 해제 안내.
  - 엔진 장애 시 복구법 및 FAQ 정리.
- **[README.md](file:///c:/markflow/README.md):**
  - 프로젝트 소개 및 핵심 온디바이스 철학.
  - 아키텍처 다이어그램 및 10대 핵심 PKM 기능 테이블.
  - 키보드 단축키 전체 치트시트.
  - 개발 모드 실행 및 패키징 빌드 가이드.

---

## 3. 로컬 패키징 검증 결과

1. **Python Sidecar PyInstaller 빌드:**
   ```
   [Build Success] Standalone sidecar binary generated:
   C:\markflow\engine\dist\engine\markflow-engine.exe (75.74 MB)
   ```
2. **Windows 배포 패키지 생성 완료 (`electron-builder`):**
   ```
   • building target=nsis file=C:\markflow\dist\MarkFlow-Windows-0.1.0-x64.exe (167.8 MB)
   • building target=portable file=C:\markflow\dist\MarkFlow-Windows-Portable-0.1.0.exe (167.5 MB)
   • resources/engine/markflow-engine.exe 번들링 정상 포함 확인 완료
   ```
3. **전체 테스트 검증:**
   - Vitest 테스트 9개 스위트 **62개 전체 통과**
   - Pytest 테스트 **11개 전체 통과**
