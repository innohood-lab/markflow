# MarkFlow 디자인 시스템 (Design System)

MarkFlow는 Things 3의 직관성과 극도의 절제미를 계승하여, 복잡한 문서 관리 도구를 단순하고 매력적인 경험으로 제공하는 것을 목표로 합니다.

---

## 1. 디자인 철학

1. **2영역(Two-Pane) 구조 고수**: 왼쪽 사이드바 + 오른쪽 본문. 상단 툴바, 복잡한 탭, 리본 메뉴 남발을 엄격히 제한합니다.
2. **시각적 위계**: 테두리(Border) 대신 섬세한 여백(Whitespace)과 차분한 회색조 단계로 위계를 표현합니다.
3. **단일 강조색 (One Accent)**: 인터랙션과 주요 상태는 차분한 신뢰의 파랑(`Primary: #2563eb`) 하나로만 집중합니다.
4. **부드러운 움직임**: 150~200ms의 미세 전환 애니메이션을 통해 기계적이지 않고 유기적인 반응성을 제공합니다.

---

## 2. 디자인 토큰 사양 (`src/renderer/src/tokens/design-tokens.ts`)

### 색상 (Color Palette)

| 토큰 | HSL / Hex 값 | 용도 |
|---|---|---|
| `primary` | `#2563eb` (`221.2 83.2% 53.3%`) | 활성 메뉴, 주요 버튼, 핵심 인터랙션 |
| `primary-hover`| `#1d4ed8` (`224.3 76.3% 48%`) | 호버 상태 |
| `background` | `#ffffff` (Dark: `#090d16`) | 앱 전체 및 본문 캔버스 배경 |
| `sidebar-bg` | `#f8fafc` (Dark: `#050811`) | 왼쪽 사이드바 배경 |
| `sidebar-border`| `#e2e8f0` (Dark: `#1e293b`) | 사이드바 구분선 (아주 얇고 부드러움) |
| `status.success`| `#10b981` | 변환 엔진 정상(Ready) 표시 점 |
| `status.error` | `#ef4444` | 변환 엔진 오류/오프라인 표시 점 |
| `status.warning`| `#f59e0b` | 검토 필요 문서 배지 |

### 타이포그래피 (Typography)

- **국문 글꼴**: Pretendard (가변 글꼴, 미려한 한국어 가독성)
- **영문 글꼴**: Apple SF Pro / Windows Segoe UI 시스템 폰트 연동
- **크기 체계**:
  - `Title`: 26px Bold (메인 본문 상단 타이틀)
  - `Subtitle`: 15px Regular (상단 설명 한 줄)
  - `Body`: 14px Medium/Regular (본문 및 메뉴 텍스트)
  - `Caption`: 12px Medium (배지, 메타데이터, 툴팁)
  - `Tiny`: 11px SemiBold (영역/태그 대문자 헤더)

### 간격 및 모서리 (Spacing & Radius)

- **8px 그리드 시스템**: `xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 32px`
- **모서리 반경**:
  - `lg: 10px` (카드, 팝오버, 툴팁)
  - `md: 8px` (사이드바 버튼, 인풋)
  - `sm: 6px` (작은 배지)
  - `full: 9999px` (상태 점, 원형 플로팅 액션 버튼)

### 그림자 (Shadows) & 모션 (Transitions)

- `shadow-subtle`: 떠 있는 느낌 없이 얇은 입체감 부여
- `shadow-floating`: 우측 하단 `(+)` 플로팅 버튼 및 툴팁에 약하게 적용
- `duration-fast`: 150ms (호버 반응)
- `duration-normal`: 200ms (화면 전환 및 테마 토글)
