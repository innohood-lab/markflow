# MarkFlow Phase 8-(다) 작업 결과 보고서: 자동 분류 제안 · 관련 문서 & 중복 탐지

## 1. 개요
Phase 8-(다)에서는 개발지시 프롬프트의 **3번(자동 분류 제안 및 관련 문서 추천)** 및 **6번(스마트 중복 탐지)** 요구사항을 구현하였습니다.
온디바이스 오프라인 환경에서 개인 지식의 프라이버시를 안전하게 지키면서, 고속 토큰화 및 코사인 유사도 연산을 통해 지능형 분류 보조, 중복 경고, 관련 문서(See Also) 추천 기능을 완성하였습니다.

---

## 2. 주요 구현 내역

### 1) Python Sidecar 로컬 유사도 분석 엔진 (`engine/src/markflow_engine/similarity.py`)
- **`clean_markdown_text(text)`**:
  - YAML Frontmatter, 코드 블록, 이미지/링크 문법, 위키 링크 등을 정규화하여 순수 본문 텍스트 추출.
- **`extract_features(text)`**:
  - 한국어와 영어를 아우르는 단어 바이그램 및 3-gram(트라이그램) 특징 벡터 고속 추출.
- **`cosine_similarity(counter1, counter2)`**:
  - 희소 벡터 간 코사인 유사도를 수학적으로 계산 (0.0 ~ 1.0).
- **`analyze_recommendations(...)`**:
  - 후보 문서들과의 유사도를 바탕으로 3가지 기능 동시 산출:
    1. **스마트 중복 감지**: 유사도 90% 이상인 경우 `is_duplicate: True` 플래그 및 원본 매칭 정보(`slug`, `title`, `score`) 반환.
    2. **관련 문서(See Also) 랭킹**: 상위 N개 유사 문서를 백분율 점수 및 요약 스니펫과 함께 정렬하여 반환.
    3. **자동 분류 제안(가중 투표)**: 유사도가 높은 상위 문서들이 속한 `groups`와 `tags`를 가중 투표하여 최적의 추천 그룹(`suggested_group`, `group_confidence`)과 추천 태그(`suggested_tags`) 산출.
- **FastAPI 엔드포인트 등록 (`/similarity/recommendations`)** in `api.py`.

### 2) 데스크톱 메인 프로세스 연동 (`aiRecommendationService.ts` & `index.ts`)
- **`getLibraryCandidates(libraryDir)`**:
  - 보관함 내 마크다운 파일들의 메타데이터(제목, 소속 그룹, 태그) 및 본문을 고속 인덱싱.
- **`getRecommendations(text, slug, libraryDir, sidecar)`**:
  - Sidecar 엔진에 우선 요청하며, Sidecar가 아직 준비되지 않은 환경에서도 완벽히 동작하도록 Node.js 자체 내장 로컬 Fallback 유사도 엔진 탑재 (이중 안정성 확보).
- **IPC 등록**: `ai:get-recommendations`.

### 3) 프론트엔드 UI/UX 구현 (`DetailViewer.tsx` & `FrontmatterForm.tsx`)
- **스마트 중복 감지 경고 배너 (`Duplicate Warning Banner`)**:
  - 내용이 90% 이상 일치하는 기존 문서가 감지되면 상단에 앰버 컬러 경고 카드 노출:
    `⚠️ 중복 감지: 기존 문서 'XXX'와 내용이 94.2% 일치합니다.`
  - `[원본 비교]` 버튼 클릭 시 해당 원본 문서로 즉시 이동.
  - `[닫기]` 버튼으로 확인 후 닫기 가능.
- **AI 자동 분류 제안 배너 (`Suggested Group Banner`)**:
  - 해당 문서가 아직 특정 그룹에 분류되지 않았고 관련 문서들이 속한 그룹이 명확할 때 인디고 컬러 배지 노출:
    `💡 AI 자동 분류 제안: 이 문서는 [업무/프로젝트A] 그룹과 88.5% 유사합니다.`
  - `[분류 적용]` 버튼 원클릭으로 Frontmatter `groups: ["업무/프로젝트A"]`에 즉시 반영 및 저장.
- **관련 문서 (AI 추천 - See Also) 아코디언**:
  - 미리보기 탭 하단에 역링크 섹션과 함께 "관련 문서 (AI 추천 N개)" 섹션 배치.
  - 유사도 백분율(예: `85.4% 유사`), 문서 제목, 소속 그룹, 본문 요약 스니펫을 카드 형태로 제공하며 클릭 시 해당 문서로 즉시 화면 전환.

---

## 3. 테스트 및 검증 결과

1. **Python Sidecar 유사도 테스트 (`engine/tests/test_similarity.py` 포함 9개 테스트)**
   - 9개 테스트 전체 통과 (소요 시간 1.96초)
   - 텍스트 정규화, 동일 문서 유사도(>=0.99), 이종 문서 유사도 분리, 중복 플래그 검출, 그룹 추천 검증 완료

2. **Desktop Vitest 단위 테스트 (`apps/desktop/tests/pkm_part3.test.ts` 포함 7개 파일)**
   - 총 47개 테스트 전체 통과 (소요 시간 591ms)
   - 중복 감지(>=90%), 그룹/태그 제안, 랭킹 정렬 및 비매칭 고립 문서 격리 검증 완료

3. **Electron-Vite 프로덕션 빌드**
   - TypeScript 컴파일 및 번들링 정상 완료
