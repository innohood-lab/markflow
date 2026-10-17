# Phase 0 완료 보고서: 개발 환경 점검 및 설정

이 문서는 MarkFlow 프로젝트 개발을 위한 기본 도구 환경 점검 결과와 설치 내역, 사용자가 수행할 GitHub 인증 절차를 정리한 문서입니다.

---

## 1. 설치된 도구 점검 결과 표

| 도구 | 권장/필수 버전 | 설치된 버전 | 설치 경로 / 비고 | 상태 |
|---|---|---|---|---|
| **Python** | 3.12.x | **Python 3.12.14** | `~/.local/bin/python3.12.exe` (uv 관리) | ✅ 정상 |
| **uv** | 최신 | **uv 0.12.18** | `~/.local/bin/uv.exe` | ✅ 정상 |
| **Node.js** | LTS (20+) | **v24.20.0 (LTS)** | `%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_...` | ✅ 정상 |
| **pnpm** | 최신 | **12.11.2** | `%LOCALAPPDATA%\Microsoft\WinGet\Packages\pnpm.pnpm_...` | ✅ 정상 |
| **Git** | 최신 | **git version 2.56.0.windows.2** | `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.MinGit_...` | ✅ 정상 |
| **GitHub CLI (gh)** | 최신 | **gh version 2.102.0** | `%LOCALAPPDATA%\Microsoft\WinGet\Packages\GitHub.cli_...` | ✅ 정상 |

---

## 2. 에이전트가 직접 수행한 작업 내용

1. **개발 환경 점검**:
   - Python 3.12 및 uv의 기설치 여부와 실제 구동 상태 확인
   - 미설치된 Node.js(LTS), pnpm, Git, GitHub CLI(gh) 확인
2. **비관리자 사용자 권한(User Scope) 무인 설치**:
   - Windows UAC(관리자 권한 요청) 팝업이나 중단 없이 설치되도록 WinGet의 `--scope user` 옵션을 활용하여 Node.js LTS, pnpm, MinGit, gh 설치 완료
3. **환경 변수 및 도구 동작 검증**:
   - 새로 설치된 도구들의 명령어가 정상 실행되고 버전을 정확히 반환하는지 검증
4. **Git 저장소 초기화 및 규칙 구성**:
   - `git init -b main`으로 로컬 저장소 초기화
   - 규칙 파일(.agents/rules/markflow-rules.md) 배치
   - 필수 제외 패턴(`node_modules`, `.venv`, `dist`, `out`, `*.log`, `.env`, `Library`, `userData` 등)이 포함된 `.gitignore` 생성

---

## 3. GitHub 인증 및 저장소 연결 완료

1. **GitHub 계정 인증**: `innohood-lab` (Kyujin Park / `innohood@gmail.com`) 인증 완료 (`gh auth login`)
2. **Git 설정**: `user.name="Kyujin Park"`, `user.email="innohood@gmail.com"` 설정 완료
3. **비공개 저장소 생성 및 원격 연결**:
   - 저장소: `https://github.com/innohood-lab/markflow` (비공개, Private)
   - 원격 브랜치: `origin https://github.com/innohood-lab/markflow.git` 연결 완료

---

## 4. 완료 기준 검증 (Phase 0 종료 확인)

- [x] 터미널에서 `node -v` (`v24.20.0`), `python3.12 --version` (`Python 3.12.14`), `uv --version` (`uv 0.12.18`) 출력 확인
- [x] 터미널에서 `pnpm -v` (`12.11.2`), `git --version` (`2.56.0`), `gh --version` (`2.102.0`) 출력 확인
- [x] GitHub에 `innohood-lab/markflow` 비공개 저장소 생성 및 `origin` 연결 확인


## 5. OS별 설치 명령 가이드 (참고용)

### macOS (Homebrew 기준)
```bash
# Homebrew 패키지 설치
brew install node pnpm python@3.12 uv git gh

# gh 로그인
gh auth login
```

### Windows 11 (WinGet 기준)
```powershell
# 사용자 권한(User Scope) 무인 설치
winget install --id OpenJS.NodeJS.LTS -e --scope user --accept-source-agreements --accept-package-agreements
winget install --id pnpm.pnpm -e --scope user --accept-source-agreements --accept-package-agreements
winget install --id Git.MinGit -e --scope user --accept-source-agreements --accept-package-agreements
winget install --id GitHub.cli -e --scope user --accept-source-agreements --accept-package-agreements

# uv를 통한 Python 3.12 설치 (필요 시)
uv python install 3.12
```
