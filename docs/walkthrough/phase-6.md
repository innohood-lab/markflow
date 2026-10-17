# Phase 6 완료 보고서: 클라우드 저장소 연결 (가져오기 · 저장 · 감시 폴더)

이 문서는 MarkFlow에서 **Google Drive, Microsoft OneDrive, Dropbox, Apple iCloud Drive**와의 유기적 연동 및 자동 수집을 위해 구현된 **Phase 6: 클라우드 저장소 연결(가져오기·저장·감시)** 기능의 상세 내용과 사용 방법을 안내합니다.

---

## 1. 무엇을 만들었는가?

### ① 통합 저장소 어댑터 (`StorageAdapter` & `LocalFolderAdapter`)
- **다양한 저장소의 단일 인터페이스 추상화**:
  - `list(folderPath)`: 디렉터리 탐색 (폴더 우선 정렬, 지원 확장자 자동 필터링).
  - `read(itemPath, destPath)`: 로컬 임시 저장소로 안전 복사.
  - `write(destPath, content)`: 문서 및 에셋 파일 안전 기록.
  - `exists(itemPath)`: 파일 및 폴더 존재 여부 확인.
- **★ 스마트 동기화 및 온라인 전용 파일(Placeholder) 감지**:
  - iCloud Drive의 `.filename.pdf.icloud` 및 클라우드 온디맨드 스텁 파일을 자동으로 식별합니다.
  - 목록 표시 시 원래 파일명(`filename.pdf`)과 함께 `온라인 전용` 주황색 배지를 부착하고, 사용자가 클라우드 앱에서 먼저 다운로드하도록 안내 메시지를 표시하여 앱 충돌을 방지합니다.

### ② 클라우드 동기화 경로 자동 탐색기 (`cloudDetector.ts`)
- **Windows / macOS 크로스 플랫폼 자동 감지**:
  - **Google Drive**: 가상 드라이브 문자(`G:\내 드라이브`, `My Drive`) 및 macOS `~/Library/CloudStorage/GoogleDrive-*` 자동 탐색.
  - **Microsoft OneDrive**: 환경 변수(`%OneDrive%`, `%OneDriveConsumer%`, `%OneDriveCommercial%`) 및 macOS CloudStorage 경로 자동 탐색.
  - **Dropbox**: `%APPDATA%\Dropbox\info.json` 및 `~/.dropbox/info.json` 파싱을 통한 개인용/업무용 경로 자동 탐색.
  - **Apple iCloud Drive**: macOS `com~apple~CloudDocs` 및 Windows `%USERPROFILE%\iCloudDrive` 자동 감지.
  - **사용자 지정 폴더(Custom Folders)**: NAS, 외장 하드, 사내 공유 폴더 등 사용자가 등록한 임의의 폴더 지원.

### ③ 백그라운드 자동 수집 감시 폴더 서비스 (`watchFolderService.ts`)
- **실시간 파일 감시 (`chokidar`)**:
  - 등록된 감시 폴더에 새 문서(`pdf`, `docx`, `pptx`, `xlsx`, `html`, `png` 등)가 생성되거나 수정되면 자동으로 감지합니다.
- **5초 쓰기 완료 대기 (Stabilization Debounce)**:
  - 클라우드 동기화 프로그램이 대용량 파일을 다운로드하거나 쓰는 도중에 읽기 시도로 파일이 손상되는 것을 막기 위해, 5초 동안 파일 크기가 일정하게 유지될 때까지 기다린 후 처리를 시작합니다.
- **★ SHA-256 해시 기반 중복 변환 루프 방지**:
  - 파일의 SHA-256 해시를 계산하고 SQLite의 기존 변환 이력(`conversions.file_hash`)과 대조하여, 이미 처리된 파일은 자동으로 건너뛰어 무한 변환 루프를 원천 차단합니다.
- **UI 자동 수집 대기열 등록**:
  - 안정화 및 중복 검증을 통과한 문서는 Electron 메인 프로세스에서 렌더러로 `watch:file-detected` 이벤트를 발송하여, 수집함 큐에 `Watch:<경로>` 출처 메타데이터와 함께 즉시 자동 추가됩니다.

### ④ 수집함 2분할 뷰: 클라우드 파일 브라우저 UI (`CloudFileBrowser.tsx`)
- **[내 PC 파일 선택] vs [클라우드 저장소] 탭 전환**:
  - 기존 로컬 파일 드래그 앤 드롭 영역 위에 정갈한 탭 바를 배치하여 원클릭으로 모드를 전환할 수 있습니다.
- **공급자 칩 & 브레드크럼 탐색**:
  - 감지된 Google Drive, OneDrive, Dropbox, iCloud 계정이 상단에 칩 형태로 나열됩니다.
  - 클릭 시 해당 드라이브의 폴더 구조를 실시간으로 탐색할 수 있으며, 상단 브레드크럼 경로 바를 통해 상위 폴더로 손쉽게 이동할 수 있습니다.
- **다중 선택 & 즉시 큐 등록**:
  - 체크박스로 여러 문서를 선택하고 하단 `[선택한 N개 파일 변환 대기열에 추가]` 버튼을 누르면 원본 경로 및 출처 정보와 함께 수집함 큐에 일괄 추가됩니다.

### ⑤ 클라우드 대상 폴더 저장(내보내기) 기능 (`settingsService.ts`)
- **유연한 폴더 체계 규칙**:
  - **단일 폴더 규칙 (Flat)**: `<대상폴더>/MarkFlow/<slug>.md`
  - **날짜별 폴더 규칙 (Date)**: `<대상폴더>/MarkFlow/YYYY/MM/<slug>.md`
- **에셋 동반 복사**: 본문에서 참조하는 `assets/<slug>/` 이미지들을 대상 폴더 하위로 완벽하게 복제하여 클라우드 드라이브 웹 또는 모바일 뷰어에서도 이미지가 정상 출력됩니다.
- **상태 및 로그 추적**: `exported_json`에 클라우드 제공자명, 저장 경로, 내보낸 시각을 영구 기록합니다.

### ⑥ 설정 모달 내 [클라우드 저장소 & 감시] 탭 (`SettingsModal.tsx`)
- **감지된 클라우드 계정 상태 확인**: 내 PC에서 감지된 Google Drive, OneDrive, Dropbox, iCloud의 로컬 경로 및 상태가 일목요연하게 표시됩니다.
- **저장 대상 폴더(Destination) 관리**: 사용자가 원하는 클라우드 폴더를 저장 대상으로 추가하고, 단일 폴더 또는 날짜별 폴더 규칙을 설정할 수 있습니다.
- **감시 폴더(Watch Folder) 관리**: 클라우드 다운로드 폴더나 특정 작업 디렉터리를 감시 폴더로 지정하고 On/Off 토글할 수 있습니다.

---

## 2. 사용자가 확인하는 방법 (단계별 가이드)

### ① 클라우드 저장소 파일 브라우저 사용하기
1. MarkFlow 앱 왼쪽 **수집함(Inbox)** 화면 상단에서 **`[클라우드 저장소]`** 탭을 클릭합니다.
2. 상단에 나타나는 공급자 칩(예: `Google Drive (G:)`, `OneDrive`, `iCloud Drive`) 중 하나를 클릭합니다.
3. 드라이브 내 폴더와 파일 목록이 나타나며, 변환하고자 하는 문서 파일들을 체크박스로 선택합니다.
4. 하단의 **`[선택한 N개 파일 변환 대기열에 추가]`** 버튼을 클릭하면 수집함 대기열에 즉시 등록되어 변환할 수 있습니다.

### ② 감시 폴더(Watch Folder) 설정 및 자동 수집 테스트
1. 좌측 하단 **설정 톱니바퀴(`⚙`)** 아이콘을 클릭하고 **[클라우드 저장소 & 감시]** 탭을 선택합니다.
2. **`감시 폴더 (Watch Folders)`** 섹션에서 **`[+ 감시 폴더 추가]`** 버튼을 클릭하여 테스트할 로컬 또는 클라우드 폴더를 선택합니다.
3. 해당 폴더에 새로운 문서 파일(예: `report.docx` 또는 `sample.pdf`)을 저장하거나 복사합니다.
4. 약 5초 후(쓰기 안정화 완료 시점), MarkFlow 수집함 목록에 새 문서가 자동으로 등록되는 것을 확인합니다.
5. 동일한 파일을 다시 복사하더라도 SHA-256 중복 검증 덕분에 불필요한 재변환이 발생하지 않습니다.

### ③ 클라우드 폴더로 마크다운 내보내기
1. **[클라우드 저장소 & 감시]** 설정 탭의 **`저장 대상 폴더 (Cloud Destinations)`** 섹션에서 **`[+ 저장 대상 추가]`**를 클릭합니다.
2. 공급자(Google Drive, OneDrive 등), 폴더 경로, 폴더 체계(단일 폴더 `MarkFlow/` 또는 날짜별 `MarkFlow/YYYY/MM/`)를 지정하고 저장합니다.
3. 수집함 또는 내역 목록에서 문서를 선택하고 내보내기를 실행하면 지정한 클라우드 폴더로 마크다운과 첨부 이미지가 안전하게 복사됩니다.

---

## 3. 검증 및 품질 결과

- **Vitest 데스크톱 단위 테스트**:
  - `tests/cloud.test.ts`: **9개 신규 테스트 통과** (LocalFolderAdapter 탐색, .icloud 감지, 플레이스홀더 차단, SHA-256 해시, 감시 경로 관리, 단일/날짜별 폴더 내보내기).
  - 전체 단위 테스트: **3개 파일, 17개 테스트 100% 통과**.
- **Python Golden Set 테스트**:
  - `engine/tests/`: **5개 테스트 100% 통과**.
- **Electron 프로덕션 빌드**:
  - `pnpm --filter @markflow/desktop build`: **SSR Main, Preload, Renderer 번들 에러 0건 성공**.
