# MarkFlow 데스크톱 설치 및 실행 가이드 (Installation Guide)

MarkFlow는 외부 Python 런타임이나 Node.js 사전 설치 없이도 **즉시 실행 가능한 올인원(All-in-One) 독립 배포 패키지**를 제공합니다.

---

## 1. 지원 운영체제 및 다운로드

최신 릴리스 패키지는 GitHub Releases 페이지에서 다운로드할 수 있습니다:
👉 **[MarkFlow Releases](https://github.com/innohood-lab/markflow/releases)**

| 운영체제 | 패키지 형식 | 파일명 형식 | 특징 |
| :--- | :--- | :--- | :--- |
| **Windows** | NSIS 설치 프로그램 | `MarkFlow-Windows-Setup-0.1.0-x64.exe` | 시작 메뉴 / 바탕화면 바로가기 및 파일 연결 |
| **Windows** | 무설치 포터블 | `MarkFlow-Windows-Portable-0.1.0.exe` | 설치 없이 USB 또는 임의 폴더에서 즉시 실행 |
| **macOS** | DMG 디스크 이미지 | `MarkFlow-macOS-0.1.0-universal.dmg` | Intel 및 Apple Silicon (M1/M2/M3/M4) 통합 지원 |
| **macOS** | Zip 아카이브 | `MarkFlow-macOS-0.1.0-universal.zip` | 압축 해제 후 바로 실행 |

---

## 2. Windows 설치 안내

### 1) NSIS 설치 프로그램 (`.exe`)
1. 다운로드한 `MarkFlow-Windows-Setup-0.1.0-x64.exe`를 실행합니다.
2. 설치 디렉터리를 지정하고 **[설치]**를 클릭합니다.
3. 설치가 완료되면 바탕화면 또는 시작 메뉴의 **MarkFlow** 바로가기를 통해 앱을 실행합니다.

> [!NOTE]
> **Windows SmartScreen 경고가 나타나는 경우:**
> 신규 오픈소스 바이너리의 경우 "Windows의 PC 보호" 파란색 팝업이 표시될 수 있습니다.
> **[추가 정보]**를 클릭한 후 나타나는 **[실행]** 버튼을 클릭하시면 정상 실행됩니다.

### 2) 포터블 버전 (`Portable.exe`)
1. `MarkFlow-Windows-Portable-0.1.0.exe`를 원하는 폴더(또는 외장 드라이브)로 복사합니다.
2. 실행 시 별도의 레지스트리 등록 없이 독립적으로 구동됩니다.
3. 모든 문서 보관함은 사용자의 `Documents/MarkFlow/Library` (또는 환경설정에서 지정한 경로)에 안전하게 유지됩니다.

---

## 3. macOS 설치 안내

### 1) DMG 디스크 이미지를 통한 설치
1. `MarkFlow-macOS-0.1.0-universal.dmg` 파일을 더블 클릭하여 마운트합니다.
2. 열린 창에서 **MarkFlow** 아이콘을 **Applications** 폴더로 드래그 앤 드롭합니다.
3. 응용 프로그램 폴더에서 MarkFlow를 실행합니다.

> [!IMPORTANT]
> **Apple Gatekeeper ("확인되지 않은 개발자") 보안 경고 우회 안내:**
> Apple 공증(Notarization) 인증서가 없는 오픈소스 빌드를 처음 실행할 때 다음 경고가 발생할 수 있습니다:
> *"확인되지 않은 개발자가 배포했기 때문에 'MarkFlow'을(를) 열 수 없습니다."*
>
> **해결 방법 (둘 중 하나 선택):**
> 1. **시스템 설정에서 허용:**
>    - **Apple 메뉴 $\rightarrow$ 시스템 설정 $\rightarrow$ 개인정보 보호 및 보안**으로 이동합니다.
>    - 하단 보안 섹션에서 **"확인 없이 열기"** 버튼을 클릭합니다.
> 2. **터미널 명령어로 1회 격리 속성 제거:**
>    ```bash
>    xattr -cr /Applications/MarkFlow.app
>    ```

---

## 4. 오프라인 및 온디바이스 동작 보증

- **외부 의존성 제로:** MarkFlow 패키지 내부에는 Microsoft MarkItDown을 구동하기 위한 독립 실행형 바이너리(`markflow-engine`)가 동봉되어 있습니다. 사용자의 컴퓨터에 Python, pip, uv, Node.js가 설치되어 있지 않아도 완벽하게 동작합니다.
- **폐쇄망 및 비행기 모드 지원:** 모든 텍스트 변환, 수식 추출, 유사도 분석 및 스마트 그룹 필터링은 컴퓨터 내부(127.0.0.1)에서 완결되며, 사용자가 명시적으로 GitHub에 푸시하지 않는 한 외부 네트워크 통신이 발생하지 않습니다.

---

## 5. 자주 묻는 질문 및 문제 해결 (Troubleshooting)

### Q1. 변환 엔진 상태가 'stopped' 또는 'error'로 표시됩니다.
- 환경설정(`Ctrl+,`) $\rightarrow$ **[정보 & 진단]** 탭으로 이동합니다.
- **[엔진 재시작]** 버튼을 클릭하면 Electron이 사이드카 프로세스를 즉시 재기동합니다.
- 문제가 지속될 경우 **[로그 폴더 열기]**를 클릭하여 당일 생성된 `markflow-YYYY-MM-DD.log` 파일에서 상세 원인을 확인할 수 있습니다.

### Q2. 기존 Obsidian 보관함과 함께 사용할 수 있나요?
- 네, 완벽히 호환됩니다. 환경설정의 **[내보내기]** 탭에서 기존 Obsidian 볼트 폴더를 지정하면, `.obsidian` 설정을 감지하여 인박스(`00_Inbox/MarkFlow`) 및 첨부파일(`attachments/MarkFlow`) 폴더로 변환된 표준 마크다운 문서를 직접 동기화합니다.
- 마크다운 내 위키 링크(`[[문서명]]`)는 Obsidian 그래프 뷰와 양방향 호환됩니다.

### Q3. 개인 GitHub 토큰(PAT)이나 API 키는 안전하게 보호되나요?
- 모든 비밀 토큰은 운영체제 네이티브 안전 저장소(Windows DPAPI, macOS Keychain)를 통해 암호화되어 로컬에만 저장됩니다.
- 진단 로그 파일에 기록될 때도 `ghp_****`, `sk-****` 등으로 자동 마스킹 처리되어 개인정보 유출을 방지합니다.
