# MarkFlow: 온디바이스 마크다운 지식 보관소 (PKM Desktop Platform)

[![GitHub Release](https://img.shields.io/github/v/release/innohood-lab/markflow?color=blue&style=flat-square)](https://github.com/innohood-lab/markflow/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-indigo.svg?style=flat-square)](https://github.com/innohood-lab/markflow/releases)
[![Python](https://img.shields.io/badge/Python-3.12%2B-amber.svg?style=flat-square)](https://www.python.org/)
[![Electron](https://img.shields.io/badge/Electron-34%2B-blueviolet.svg?style=flat-square)](https://www.electronjs.org/)

**MarkFlow**는 인터넷 연결이나 상용 클라우드 종속 없이, 내 컴퓨터의 온디바이스(Local-first) 환경에서 다양한 형식의 문서(Word, PowerPoint, Excel, PDF, 이미지 등)를 **표준 마크다운(Markdown)**으로 변환하고 체계적으로 관리·연결·내보내는 차세대 개인 지식 관리(PKM, Personal Knowledge Management) 데스크톱 애플리케이션입니다.

---

## 🌟 핵심 가치 (Core Philosophy)

1. **온디바이스 우선 (Local-First & Privacy):**
   - 모든 텍스트 변환, 수식 추출, 유사도 분석, 스마트 그룹 검색이 로컬 시스템 내부(127.0.0.1)에서 완결됩니다.
   - 외부 서버로 개인 문서나 메타데이터가 전송되지 않습니다.
2. **벤더 종속 탈피 (Zero Vendor Lock-In):**
   - 지식 보관소(Library)의 모든 데이터는 표준 마크다운 파일(`.md`)과 원본 자산으로 영구 보존됩니다.
   - Obsidian, VS Code, Logseq, Logseq 등 임의의 마크다운 툴과 100% 호환됩니다.
3. **Microsoft MarkItDown 엔진 탑재:**
   - Microsoft의 공식 `markitdown` 파이프라인을 내장하여 표(Table), 수식(LaTeX), 계층형 헤딩, 이미지 캡션을 정밀하게 보존합니다.
4. **Things 3 & Apple 미니멀리즘 인터페이스:**
   - 정돈된 타이포그래피, 우아한 여백, 부드러운 반응형 트랜지션으로 작업에만 집중할 수 있는 사용자 경험을 제공합니다.

---

## 📐 아키텍처 개요 (Architecture)

```
+-------------------------------------------------------------------------+
|                         MarkFlow Desktop App                            |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |             Electron 34 Renderer (React 18 + Tailwind)            |  |
|  |   - Things 3 사이드바 / 3단 스플릿 뷰 / 보드 뷰 / 위키 링크 자동완성|  |
|  |   - 커맨드 팔레트(Ctrl+K) / 빠른 캡처 / 단축키 치트시트 / 온보딩      |  |
|  +-------------------------------------------------------------------+  |
|                                    | contextBridge (markflowApi)         |
|  +-------------------------------------------------------------------+  |
|  |                 Electron Main Process (Node.js)                   |  |
|  |   - Better-SQLite3 로컬 캐시 메타데이터                             |  |
|  |   - LibraryWatcher / WatchFolderService (5초 주기 감시)            |  |
|  |   - safeStorage (Windows DPAPI / macOS Keychain 토큰 암호화)       |  |
|  |   - LoggerService (일별 회전 로그 + 토큰 자동 정규식 마스킹)          |  |
|  |   - SidecarManager (루프백 127.0.0.1 동적 포트 + X-Engine-Secret)  |  |
|  +-------------------------------------------------------------------+  |
|                                    | REST (127.0.0.1:DynamicPort)        |
|  +-------------------------------------------------------------------+  |
|  |                 Python 3.12 Sidecar Engine (FastAPI)              |  |
|  |   - Standalone PyInstaller 번들 (markflow-engine[.exe])            |  |
|  |   - Microsoft MarkItDown + PyPDF + LXML 정밀 변환                   |  |
|  |   - 문자 트라이그램 & 코사인 유사도 분석 (자동 분류 / 중복 탐지)      |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 🎯 10대 핵심 PKM 기능

| 번호 | 기능 구분 | 세부 내용 |
| :---: | :--- | :--- |
| **01** | **변환 큐 & 품질 프로필** | Word, PPT, Excel, PDF, 이미지, CSV 등 드래그 앤 드롭 일괄 변환 (Balanced / Fast / Best Quality 3종 프로필) |
| **02** | **3단 스플릿 뷰어** | 사이드바 - 인박스/문서 목록 - 마크다운 렌더러 & 원문 비교 인라인 실시간 편집기 |
| **03** | **Notion 스타일 보드 뷰** | 상태별 칸반 보드 (미검토/검토완료/보관), 카테고리/태그 다중 필터링, 일괄 상태 변경 |
| **04** | **계층형 그룹 체계** | 영역(Area) > 프로젝트(Project) 2계층 구조 및 **DEVONthink 복제체(Replicant)** 지원 |
| **05** | **스마트 그룹 & 검색 문법** | 실시간 쿼리 필터링 (`status:`, `score:`, `group:`, `tag:`, `is:starred`, `created:`) |
| **06** | **오늘 & 기록 뷰** | Things 3 스타일 일일 큐레이션 (오늘 처리할 문서, 별표 즐겨찾기, 최근 완료 기록) |
| **07** | **위키 링크 & 백링크 & 하이라이트** | 실시간 `[[` 문서 자동완성, 문서 간 양방향 백링크 탐색, 텍스트 하이라이트 & 각주 메모 모음 |
| **08** | **온디바이스 AI 유사도 제안** | 머신러닝 기반 최적 그룹 분류 제안, 관련 문서(See Also) 탐색, 90% 이상 중복 문서 실시간 경고 |
| **09** | **템플릿 시스템 & 빠른 캡처** | 회의록, 기획서, 기술 분석, 주간 회고 기본 4종 + 사용자 템플릿, `Ctrl+Shift+Space` 즉시 메모 팝업 |
| **10** | **커맨드 팔레트 & 단축키** | `Ctrl+K` 전역 고속 검색, `?` 전역 단축키 치트시트 모달, 마우스 없는 풀 키보드 워크플로우 |

---

## 🔗 외부 지식 저장소 연동

- **GitHub LLM-wiki:** Git Data API를 통해 마크다운 본문과 관련 이미지 자산을 원자적 단일 커밋으로 원격 저장소에 반영합니다.
- **Obsidian 보관함:** 기존 Obsidian 볼트 폴더를 지정하여 `.obsidian` 설정을 검지하고, 인박스(`00_Inbox/MarkFlow`) 및 첨부파일(`attachments/MarkFlow`) 폴더로 직접 동기화합니다.
- **클라우드 감시 폴더 (Watch Folders):** Google Drive, Dropbox, OneDrive, iCloud를 자동 감지하며, 5초 주기로 새 파일 유입을 감지하여 자동 인박스로 수집합니다.

---

## ⌨️ 주요 키보드 단축키

| 단축키 | 동작 설명 |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>P</kbd> | 전역 커맨드 팔레트 (문서 검색, 뷰 이동, 액션 실행) |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd> | 어디서나 즉시 빠른 메모 캡처 팝업 열기 |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | 템플릿 선택 및 신규 마크다운 문서 생성 |
| <kbd>?</kbd> | 전역 단축키 치트시트 모달 열기 |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | 환경설정 모달 열기 (5개 탭) |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> ~ <kbd>5</kbd> | 주요 뷰 고속 전환 (수집함, 보드 뷰, 오늘, 기록, 하이라이트) |
| <kbd>Ctrl</kbd> + <kbd>E</kbd> | 선택된 문서 외부 지식 저장소(GitHub/Obsidian)로 즉시 내보내기 |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | 현재 편집 중인 마크다운 문서 즉시 저장 |
| <kbd>Esc</kbd> | 열려 있는 모든 모달 또는 상세 뷰어 닫기 |

*(macOS에서는 <kbd>Ctrl</kbd> 대신 <kbd>Cmd</kbd> 키를 사용합니다)*

---

## 🚀 빠른 시작 (개발 및 로컬 실행)

### 사전 요구사항
- Node.js `20.x` 이상
- pnpm `9.x` 이상 (`npm install -g pnpm`)
- Python `3.12` 이상
- Astral uv (`pip install uv` 또는 `curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 1. 저장소 클론 및 의존성 설치
```bash
git clone https://github.com/innohood-lab/markflow.git
cd markflow

# Node 의존성 설치
pnpm install

# Python 사이드카 의존성 설치
uv sync --project engine
```

### 2. 개발 모드 실행
```bash
# Electron 앱과 Python 사이드카가 연동되어 실행됩니다
pnpm dev
```

### 3. 단위 테스트 실행
```bash
# Vitest (62개 데스크톱 테스트) + Pytest (11개 사이드카 엔진 테스트) 일괄 검증
pnpm test:all
```

### 4. 독립 배포 패키지 빌드
```bash
# 1. Python Standalone Sidecar 바이너리 빌드 (PyInstaller)
pnpm build:engine

# 2. Electron 프로덕션 번들 빌드
pnpm build

# 3. 플랫폼별 배포 패키지 생성 (Windows .exe / macOS .dmg)
pnpm dist
```

---

## 📦 배포 및 CI/CD (GitHub Actions)

MarkFlow는 `.github/workflows/release.yml`을 통해 멀티 OS 자동 릴리스를 지원합니다.
Git 태그(예: `v0.1.0`)를 푸시하면 Windows 러너와 macOS 러너가 병렬로 기동하여 PyInstaller 사이드카 바이너리와 Electron 앱을 패키징한 후 GitHub Releases에 자동 업로드합니다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

자세한 설치 및 트러블슈팅 방법은 **[설치 가이드 (Installation Guide)](docs/installation-guide.md)**를 참조하세요.

---

## 🔒 보안 원칙

- **Electron 프로세스 격리:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- **Sidecar 통신 보호:** `127.0.0.1` 한정 바인딩 및 64자리 일회용 토큰(`X-Engine-Secret`) 검증.
- **자격 증명 보호:** Windows DPAPI / macOS Keychain 기반 OS 네이티브 암호화.
- **로그 개인정보 마스킹:** GitHub PAT, LLM API 키 자동 정규식 마스킹 처리 및 7일 자동 삭제.

상세 내용은 **[보안 체크리스트 (Security Checklist)](docs/security-checklist.md)**에서 확인하실 수 있습니다.

---

## 📄 라이선스 (License)

MarkFlow는 [MIT License](LICENSE)에 따라 자유롭게 사용, 수정, 배포할 수 있는 오픈소스 프로젝트입니다.
Copyright © 2026 Kyujin Park (innohood).
