# MarkFlow 클라우드 연동 아키텍처 및 OAuth 2.0 PKCE 가이드

이 문서는 MarkFlow에서 **Google Drive, Microsoft OneDrive, Dropbox, Apple iCloud Drive**와의 연동 아키텍처 및 직접 API 연동(OAuth 2.0 PKCE)을 위한 설정 지침을 정의합니다.

---

## 1. 이원화(Dual-Tier) 연동 아키텍처

MarkFlow는 사용자의 편의성과 안정성을 극대화하기 위해 **로컬 동기화 폴더(Sync Folder) 우선 방식**을 기본 전략으로 채택합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                       MarkFlow App                          │
│                                                             │
│  [Tier 1: 기본 전략]             [Tier 2: 보조 확장]          │
│  StorageAdapter                  OAuth 2.0 PKCE Engine      │
│  (LocalFolderAdapter)            (Direct Cloud REST API)    │
│            │                                  │             │
└────────────┼──────────────────────────────────┼─────────────┘
             ▼                                  ▼
┌─────────────────────────┐        ┌─────────────────────────┐
│ OS 동기화 클라이언트      │        │ 클라우드 REST APIs       │
│ • Google Drive 데스크톱 │        │ • Google Drive API v3   │
│ • Microsoft OneDrive    │        │ • Microsoft Graph API   │
│ • Dropbox               │        │ • Dropbox API v2        │
│ • Apple iCloud Drive    │        │                         │
└─────────────────────────┘        └─────────────────────────┘
```

### Tier 1: 로컬 동기화 폴더 연동 (기본 권장)
- **원리**: 사용자가 이미 설치해 둔 공식 클라우드 데스크톱 앱(Google Drive, OneDrive, Dropbox, iCloud)의 로컬 마운트/동기화 경로를 `StorageAdapter`를 통해 파일시스템 레벨에서 직접 읽고 씁니다.
- **장점**:
  - **설정 제로**: 별도의 개발자 콘솔 앱 등록이나 복잡한 로그인 과정 없이 즉시 사용 가능합니다.
  - **무제한 안정성**: 클라우드 API 호출 한도(Rate Limit), 토큰 만료(Refresh Token 만료) 문제가 없습니다.
  - **스마트 동기화 지원**: 각 클라우드 엔진이 제공하는 백그라운드 증분 업로드/동기화 기술을 그대로 누릴 수 있습니다.
- **온라인 전용 파일(On-demand / Smart Sync / .icloud) 감지**:
  - 파일이 로컬에 다운로드되지 않은 상태(`.filename.ext.icloud` 등)를 MarkFlow가 감지하여 사용자에게 다운로드 뱃지와 친절한 안내를 제공합니다.

### Tier 2: OAuth 2.0 PKCE 직접 API 연동 (보조 확장)
- **적용 대상**: 회사 정책이나 저장 용량 한계로 로컬 동기화 클라이언트를 설치하지 않고, 원격 클라우드 드라이브에 직접 마크다운을 업로드하고자 하는 사용자 환경.
- **보안 표준**: Electron 데스크톱 앱 환경에 맞추어 **RFC 7636 PKCE (Proof Key for Code Exchange)** 및 `http://127.0.0.1:<random-port>/oauth/callback` 로컬 루프백 리다이렉트를 사용합니다. (클라이언트 시크릿을 바이너리에 하드코딩하지 않음)
- **토큰 보관**: 발급받은 Access/Refresh Token은 Electron `safeStorage` (Windows DPAPI, macOS Keychain)로 암호화 저장됩니다.

---

## 2. 공급자별 OAuth 2.0 앱 등록 가이드 (개발자/관리자용)

### ① Google Drive API
1. **Google Cloud Console 접속**: [console.cloud.google.com](https://console.cloud.google.com/)
2. **프로젝트 생성**: `MarkFlow-Sync`
3. **API 사용 설정**:
   - `Google Drive API` 검색 후 **[사용 설정]** 클릭
4. **OAuth 동의 화면 구성**:
   - 사용자 유형: `외부(External)`
   - 앱 이름: `MarkFlow`
   - 사용자 지원 이메일 및 개발자 연락처 입력
   - **범위(Scopes)** 추가:
     - `https://www.googleapis.com/auth/drive.file` (MarkFlow 앱이 직접 생성하거나 연 파일에만 접근하는 최소 권한 원칙 준수)
5. **사용자 인증 정보 만들기**:
   - 유형: `OAuth 2.0 클라이언트 ID`
   - 애플리케이션 유형: `데스크톱 앱(Desktop App)`
   - 생성된 `Client ID` 복사 (Client Secret은 PKCE 모드이므로 불필요하거나 빈 문자열 처리)

---

### ② Microsoft OneDrive (Microsoft Graph API)
1. **Azure Portal (Entra ID) 접속**: [portal.azure.com](https://portal.azure.com/)
2. **앱 등록(App registrations)**:
   - 이름: `MarkFlow`
   - 지원되는 계정 유형: `모든 조직 디렉터리의 계정 및 개인 Microsoft 계정(예: Skype, Xbox)`
3. **인증(Authentication) 설정**:
   - 플랫폼 추가 → `모바일 및 데스크톱 응용 프로그램(Mobile and desktop applications)` 선택
   - 리디렉션 URI: `http://localhost/oauth/callback` 또는 `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. **API 사용 권한(API permissions)**:
   - Microsoft Graph (위임된 권한):
     - `Files.ReadWrite.AppFolder` (특정 앱 전용 폴더 접근) 또는 `Files.ReadWrite`
     - `offline_access` (Refresh Token 발급용)
     - `User.Read`
5. **개요 화면**:
   - `애플리케이션(클라이언트) ID` 복사

---

### ③ Dropbox API
1. **Dropbox App Console 접속**: [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
2. **앱 생성(Create app)**:
   - Choose an API: `Scoped access`
   - Choose the type of access: `App folder` (권장: `Apps/MarkFlow/` 전용 격리 폴더) 또는 `Full Dropbox`
   - Name your app: `MarkFlow-<username>`
3. **권한(Permissions) 탭**:
   - `files.content.write` 체크
   - `files.content.read` 체크
   - 하단 `Submit` 클릭
4. **설정(Settings) 탭**:
   - OAuth 2:
     - Redirect URIs: `http://localhost:54321/oauth/callback`
   - `App key` 복사

---

### ④ Apple iCloud Drive
- **Apple의 생태계 특성**: Apple은 서드파티 데스크톱 앱을 위한 공식 원격 iCloud Drive REST API를 제공하지 않습니다 (오직 iOS/macOS 네이티브 CloudKit 또는 iCloud Drive 로컬 디렉터리만 지원).
- **MarkFlow 연동 표준**: macOS(`~/Library/Mobile Documents/com~apple~CloudDocs`) 및 Windows(`%USERPROFILE%\iCloudDrive`)의 **로컬 iCloud 동기화 디렉터리를 감지하여 원활하게 연동**합니다.

---

## 3. 요약 및 권장 사항

일반 사용자는 별도의 OAuth 등록 절차 없이, PC에 설치된 **Google Drive, OneDrive, Dropbox, iCloud Drive**의 폴더를 MarkFlow [설정] → [클라우드 저장소 & 감시] 탭에서 클릭 한 번으로 지정하여 모든 기능을 100% 안정적으로 사용할 수 있습니다.
