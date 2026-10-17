# Phase 5 완료 보고서: 내보내기 — GitHub LLM-wiki / iCloud Obsidian

이 문서는 변환된 고품질 마크다운 문서와 첨부 이미지를 개인 지식 관리 시스템인 **GitHub LLM-wiki**와 **iCloud Obsidian**으로 클릭 한 번에 전송할 수 있도록 구현된 **내보내기(Phase 5)** 기능의 결과 및 사용 방법을 정리한 문서입니다.

---

## 1. 무엇을 만들었는가?

### ① Git Data API 기반 원자적 GitHub LLM-wiki 업로더 (`githubExporter.ts`)
- **Git 바이너리 설치 불필요**: 사용자 PC에 `git` 명령어가 설치되어 있지 않아도 GitHub REST API(Octokit)를 통해 100% 동작합니다.
- **원자적 단일 커밋 (Single Commit per Batch)**:
  - 10개의 문서를 동시에 내보내더라도 커밋이 10개 생기지 않고, GitHub Git Data API (`Blobs` → `Tree` → `Commit` → `Ref 갱신`)를 통해 **단 1개의 깔끔한 커밋**으로 묶여 반영됩니다.
  - 커밋 메시지: `markflow: N개 문서 추가 (2026-10-17 22:00)`
- **★ LLM-wiki 자동 동기화 보호**:
  - 맥미니 로컬 환경의 `~/LLM-wiki`가 15분 주기로 자동 `pull/push` 중이므로, MarkFlow 앱은 **오직 `inbox/markflow/` 디렉터리 내부**에만 파일을 작성하여 충돌 위험을 원천 차단합니다.
- **이미지 에셋 동반 업로드**:
  - 마크다운 문서뿐만 아니라 본문에서 참조하는 `Library/assets/<slug>/` 이미지들을 `inbox/markflow/assets/<slug>/`에 함께 커밋하여 저장소 안에서도 링크가 깨지지 않습니다.

### ② iCloud / 로컬 Obsidian 보관함 자동 복사기 (`obsidianExporter.ts`)
- **볼트 유효성 자동 검증**: 폴더 선택 시 `.obsidian` 폴더가 존재하는지 확인하여 잘못된 디렉터리 지정을 방지합니다.
- **폴더 체계 자동화**:
  - 마크다운 파일: `<볼트>/00_Inbox/MarkFlow/<slug>.md`
  - 첨부 이미지: `<볼트>/attachments/MarkFlow/<slug>/img-XXX.png`
- **상대 링크 자동 재계산**:
  - 마크다운 본문의 `assets/<slug>/img-001.png` 링크를 Obsidian 폴더 깊이에 맞게 `../../attachments/MarkFlow/<slug>/img-001.png`로 자동 보정하여 PC, Mac, iPad, iPhone의 Obsidian 앱에서 이미지가 완벽하게 표시됩니다.
- **Frontmatter 태그 호환**: `tags: ["보고서", "AX"]` 등 Obsidian 표준 YAML 태그와 100% 호환됩니다.

### ③ 안전한 비밀번호 금고 (`settingsService.ts` & `safeStorage`)
- **OS 레벨 암호화**: GitHub PAT(Personal Access Token)는 Electron의 `safeStorage` (Windows DPAPI, macOS Keychain)를 사용하여 운영체제 자격 증명 금고에 암호화 보관됩니다.
- **화면 마스킹**: 설정 화면에서는 토큰의 앞자리와 뒷자리만 안전하게 노출(`ghp_••••••••••••cdef`)됩니다.
- **원클릭 연결 테스트**: `[저장소 연결 테스트]` 버튼으로 토큰 유효성, 비공개 저장소 접근 권한, Contents 쓰기(push) 권한을 즉시 진단합니다.

### ④ Things 3 스타일 UI 연동 (`SettingsModal.tsx`, `HistorySection.tsx`, `DetailViewer.tsx`)
- **설정 모달 (`⚙`)**:
  - 사이드바 하단 톱니바퀴 클릭 시 열리는 정갈한 설정창
  - GitHub(저장소, 브랜치, 대상폴더, PAT, 발급 안내 가이드), Obsidian(볼트 폴더 선택, OS별 경로 힌트), 자동 내보내기 탭 제공
- **다중 선택 & 플로팅 액션 바 (`ExportActionBar.tsx`)**:
  - 수집함/내역 목록에서 체크박스로 여러 문서를 선택하면 화면 하단에 플로팅 바가 부드럽게 슬라이드 업:
    - `[N개 선택됨] [GitHub로] [Obsidian으로] [둘 다 내보내기] [선택 해제]`
- **상세 화면 원클릭 내보내기**:
  - 상세 보기 상단 액션 바에 `[내보내기 ▾]` 드롭다운 버튼 추가
- **배지 및 이력 반영**:
  - 성공적으로 내보내진 문서에는 `wiki ↗`, `obsidian ↗` 상태 배지가 붙으며 YAML Frontmatter의 `exported: { github: true, obsidian: true }`가 자동 갱신됩니다.
- **자동 내보내기 옵션**: 설정에서 켜두면 문서 변환이 끝나는 즉시 백그라운드에서 지정한 지식 저장소로 자동 발행됩니다.

---

## 2. 사용자가 확인하는 방법 (단계별 가이드)

### ① 설정 확인 및 GitHub PAT 연결
1. 사이드바 맨 하단의 **설정 톱니바퀴(`⚙`)** 버튼을 클릭합니다.
2. **[GitHub LLM-wiki]** 탭에서:
   - 저장소: `innohood-lab/LLM-wiki` (기본값)
   - 브랜치: `main` (기본값)
   - 대상 폴더: `inbox/markflow/` (기본값)
   - PAT 입력 칸에 발급받은 Fine-grained Token 입력
   - **`[저장소 연결 테스트]`** 버튼 클릭 → 초록색 연결 성공 메시지 확인
3. **[Obsidian 보관함]** 탭에서:
   - **`[폴더 찾기]`** 버튼을 눌러 본인의 Obsidian 보관함 폴더(또는 iCloud 동기화 폴더) 선택
   - 초록색 `유효한 Obsidian 볼트입니다` 문구 확인
4. **`[설정 저장]`** 클릭

### ② 단일 문서 내보내기
1. 수집함 목록에서 변환된 문서 하나를 더블클릭하여 **상세 화면**을 엽니다.
2. 상단 액션 바의 **`[내보내기 ▾]`** 버튼을 누르고 **`[둘 다 내보내기]`**를 선택합니다.
3. 내보내기 진행 모달이 뜨며, 잠시 후 GitHub 커밋 링크(`commit/abc1234`)와 Obsidian 저장 완료 안내가 나타납니다.
4. 링크를 클릭하면 브라우저에서 방금 올라간 커밋을 직접 볼 수 있습니다.

### ③ 여러 문서 일괄 내보내기 (Batch Export)
1. 수집함 목록에서 문서 3개의 좌측 체크박스를 선택합니다.
2. 화면 하단에 나타나는 플로팅 바에서 **`[둘 다 내보내기]`**를 클릭합니다.
3. 3개 문서와 이미지들이 Git Data API를 통해 **단 1개의 커밋**으로 묶여 업로드되고, Obsidian 보관함의 `00_Inbox/MarkFlow/`로 동시에 복사됩니다.
4. 목록의 각 문서 카드에 `wiki` 및 `obsidian` 뱃지가 부여됩니다.

---

## 3. 검증 및 테스트 결과

| 테스트 항목 | 테스트 도구 | 결과 | 설명 |
|---|:---:|:---:|---|
| **설정 암호화 / 마스킹** | Vitest | **통과** | safeStorage 암복호화 및 토큰 UI 마스킹 정상 |
| **LLM-wiki 경로 격리** | Vitest | **통과** | 대상 경로가 강제로 `inbox/markflow/` 내에 격리됨을 검증 |
| **Obsidian 볼트 검증** | Vitest | **통과** | `.obsidian` 폴더 여부로 볼트 정상 판별 |
| **Obsidian 파일 & 이미지 복사** | Vitest | **통과** | MD 복사, 에셋 복사, 상대경로 `../../attachments/...` 치환 검증 |
| **GitHub Git Data API 모의 커밋** | Vitest | **통과** | Blob 생성 → Tree 구성 → Commit 생성 → Ref 갱신 단 1개 커밋 검증 |
| **품질 파이프라인 회귀 골든셋** | Pytest | **통과** | Phase 3 골든셋 5개 테스트 100% 통과 유지 |
| **프로덕션 빌드 (Main, Preload, Renderer)** | electron-vite | **통과** | 번들링 에러 0건 (996ms 완료) |
