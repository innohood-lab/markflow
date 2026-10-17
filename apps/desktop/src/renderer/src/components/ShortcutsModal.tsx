import React from 'react'
import { Keyboard, X } from 'lucide-react'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  keys: string[]
  label: string
  desc: string
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
  const cmd = isMac ? 'Cmd' : 'Ctrl'

  const shortcutSections: { title: string; items: ShortcutItem[] }[] = [
    {
      title: '전역 및 탐색',
      items: [
        { keys: [cmd, 'K'], label: '커맨드 팔레트', desc: '문서 빠른 검색 및 모든 액션 실행' },
        { keys: [cmd, 'P'], label: '문서 빠른 열기', desc: '최근 문서 목록 및 검색' },
        { keys: [cmd, 'Shift', 'F'], label: '전역 검색', desc: 'FTS5 trigram 고속 전문 검색' },
        { keys: ['?'], label: '단축키 치트시트', desc: '키보드 단축키 도움말 열기/닫기' },
        { keys: ['Esc'], label: '닫기 / 취소', desc: '현재 열린 모달 및 팔레트 닫기' }
      ]
    },
    {
      title: '뷰 전환 (Sidebar)',
      items: [
        { keys: [cmd, '1'], label: '수집함 (Inbox)', desc: '새로 들어온 문서 대기열' },
        { keys: [cmd, '2'], label: '오늘 (Today)', desc: '오늘 처리할 중요 작업/문서' },
        { keys: [cmd, '3'], label: '검토 필요', desc: '품질 점수 70점 미만 문서 검토' },
        { keys: [cmd, '4'], label: '라이브러리', desc: '노션형 보드 (목록/표/칸반/갤러리)' },
        { keys: [cmd, '5'], label: '하이라이트 모음', desc: '형광펜 및 각주 메모 전체 뷰' },
        { keys: [cmd, '6'], label: '기록 (Logbook)', desc: '활동 및 내보내기 이력' }
      ]
    },
    {
      title: '문서 작성 & 캡처',
      items: [
        { keys: [cmd, 'N'], label: '새 문서 (템플릿)', desc: '회의록, 기획서 등 템플릿 선택 모달' },
        { keys: [cmd, 'Shift', 'Space'], label: '빠른 캡처 (Quick Capture)', desc: '즉시 생각/아이디어 수집함 저장' },
        { keys: [cmd, 'S'], label: '문서 저장', desc: '현재 편집 중인 문서 디스크 즉시 저장' },
        { keys: ['[['], label: '위키 링크 자동완성', desc: '에디터에서 다른 문서 실시간 링크' }
      ]
    },
    {
      title: '본문 텍스트 조작',
      items: [
        { keys: ['드래그 선택'], label: '플로팅 툴바', desc: '형광펜(==text==) 및 각주 메모 달기' },
        { keys: [cmd, 'F'], label: '문서 내 찾기', desc: '현재 문서 내 텍스트 검색' }
      ]
    }
  ]

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-floating flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between shrink-0 bg-sidebar-background/40">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">키보드 단축키 안내</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {shortcutSections.map((sec, sIdx) => (
            <div key={sIdx} className="space-y-2.5">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {sec.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sec.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">
                        {item.desc}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-card text-foreground border border-border shadow-subtle"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/60 bg-sidebar-background/30 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>어디서나 <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">?</kbd> 키를 누르면 이 창을 열 수 있습니다.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-card border border-border hover:bg-muted font-medium text-xs text-foreground transition-colors shadow-subtle"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
