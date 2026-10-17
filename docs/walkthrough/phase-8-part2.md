# MarkFlow Phase 8-(나) 작업 결과 보고서: 위키 링크 · 백링크 · 하이라이트 & 메모

## 1. 개요
Phase 8-(나)에서는 Obsidian/Roam Research/DEVONthink 수준의 개인 지식 관리(PKM) 핵심 기능인 **위키 링크(`[[문서명]]`)**, **실시간 자동완성**, **역링크(Backlinks) 탐지 및 이동**, **문서 제목 변경 시 참조 일괄 업데이트(Refactoring)**, 그리고 Obsidian 호환 **형광펜 하이라이트(`==text==`)** 및 **각주 메모(`[^note-id]`)**, **전체 하이라이트 모음 뷰**를 완벽하게 구현하였습니다.

---

## 2. 주요 구현 내역

### 1) 위키 링크 및 역링크 엔진 (`wikiLinkService.ts`)
- **`extractWikiLinks(markdown)`**:
  - `[[문서명]]`, `[[문서명|별칭(Alias)]]` 구문에서 대상 문서 제목을 정확히 파싱.
- **`findBacklinks(targetTitle, targetSlug, libraryDir)`**:
  - 라이브러리 내 전체 마크다운 파일을 정규식으로 고속 스캔하여 현재 문서를 참조하고 있는 모든 원본 문서 및 문맥 스니펫(Snippet) 추출.
  - 자기 자신을 참조하는 Self-link는 자동으로 제외.
- **`renameWikiLinkReferences(oldTitle, newTitle, libraryDir)`**:
  - 문서 제목이 변경될 때 다른 모든 문서에 걸쳐 참조 중인 `[[oldTitle]]` 및 `[[oldTitle|alias]]`를 `[[newTitle]]` 및 `[[newTitle|alias]]`로 안전하게 일괄 업데이트.
- **`addHighlightToDocument(filePath, selectedText)`**:
  - 지정한 텍스트에 Obsidian 호환 `==형광펜==` 서식을 인라인으로 감싸서 파일 디스크에 직접 저장. 이미 하이라이트된 경우 중복 래핑 방지.
- **`addFootnoteNoteToDocument(filePath, selectedText, noteText)`**:
  - 선택한 텍스트 뒤에 고유 각주 마커(`[^note-xxxx]`)를 부착하고 문서 최하단에 각주 내용(`[^note-xxxx]: 메모 내용`)을 안전하게 덧붙여 파일 디스크에 저장.
- **`getAllHighlights(libraryDir)`**:
  - 전체 라이브러리를 스캔하여 `==...==` 형광펜 및 `[^...]: ...` 각주 메모를 일괄 수집.

### 2) 에디터 내 `[[` 위키 링크 자동완성 (`MarkdownEditor.tsx`)
- `textarea`에서 사용자가 `[[`를 입력하면 보관함 내 문서 제목 목록을 실시간으로 검색하여 팝업 드롭다운 제공.
- 키보드 위/아래 방향키와 Enter 키로 선택하여 `[[선택한문서]]` 자동 완성 및 커서 위치 자동 조정.
- Esc 키 또는 다른 텍스트 입력 시 자연스럽게 닫힘.

### 3) 미리보기 내 인터랙티브 렌더링 & 플로팅 툴바 (`MarkdownPreview.tsx`)
- **위키링크 인터랙티브 전환**:
  - 본문의 `[[Target|Alias]]`를 클릭 가능한 링크 버튼으로 자동 파싱. 클릭 시 해당 문서로 즉시 이동.
- **형광펜 & 각주 렌더링**:
  - `==text==` 문법을 부드러운 앰버/옐로우 배경의 `<mark>` 태그로 렌더링.
  - `[^note-id]` 각주 마커를 툴팁 가능한 상첨자 배지로 표시.
- **텍스트 선택 플로팅 팝오버 (`HighlightPopover`)**:
  - 본문 텍스트를 마우스로 드래그 선택하면 텍스트 바로 위에 `[하이라이트]`, `[메모]` 툴바가 부유(Float).
  - `[하이라이트]` 클릭 시 파일 디스크 즉시 수정 및 본문 자동 반영.
  - `[메모]` 클릭 시 팝오버 인풋창이 열려 메모 작성 후 각주 형태로 저장.

### 4) 상세 뷰어 역링크 섹션 (`DetailViewer.tsx`)
- 미리보기 하단에 Things 3 스타일의 깔끔한 접이식 **"역링크 (Backlinks N개)"** 섹션 제공.
- 현재 문서를 참조하고 있는 다른 문서들의 제목, 파일명, 주변 스니펫을 표시하며, 클릭 시 해당 문서로 즉시 화면 전환(`onNavigateDocument`).

### 5) 전체 하이라이트 & 메모 모음 뷰 (`HighlightsView.tsx`)
- 사이드바 네비게이션에 `[하이라이트 모음]` 메뉴 추가.
- 전체 라이브러리의 형광펜 및 각주 메모를 문서별로 그룹화하여 카드 형태로 표시.
- 검색 필터(텍스트/메모 내용 검색), 타입 필터(전체 / 형광펜 / 각주 메모) 지원.
- 카드 클릭 시 원본 문서의 상세 뷰어로 즉시 점프.

---

## 3. 테스트 및 검증 결과

1. **Vitest 단위 테스트 (`apps/desktop/tests/pkm_part2.test.ts` 등 6개 파일)**
   - 총 43개 테스트 전체 통과 (소요 시간 579ms)
   - `extractWikiLinks`: 일반 링크 및 별칭 링크 파싱 검증 완료
   - `findBacklinks`: 참조 문서 검출 및 스니펫 추출, self-link 무시 검증 완료
   - `renameWikiLinkReferences`: 파일 간 위키링크 및 별칭 보존 일괄 이름 변경 검증 완료
   - `addHighlightToDocument`: `==text==` 래핑 및 멱등성 검증 완료
   - `addFootnoteNoteToDocument`: 각주 마커 및 하단 정의 삽입 검증 완료
   - `getAllHighlights`: 라이브러리 전체 형광펜/메모 수집 검증 완료

2. **Python Golden Set 테스트 (`engine/tests`)**
   - 5개 골든 셋 테스트 전체 통과

3. **Electron-Vite 프로덕션 빌드**
   - 메인 프로세스, 프리로드, 렌더러 전체 무오류 컴파일 및 번들링 완료
