import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  FileText,
  Inbox,
  Star,
  AlertCircle,
  BookOpen,
  Highlighter,
  Calendar,
  Zap,
  LayoutTemplate
} from 'lucide-react'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  action: () => void
  category: '문서' | '바로가기' | '액션'
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigateDocument: (slug: string) => void
  onSelectView: (view: string) => void
  onOpenQuickCapture: () => void
  onOpenTemplatePicker: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateDocument,
  onSelectView,
  onOpenQuickCapture,
  onOpenTemplatePicker
}) => {
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<{ title: string; slug: string }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
      if (window.markflowApi?.getBoardDocuments) {
        window.markflowApi.getBoardDocuments({ limit: 150 }).then((res) => {
          if (res && res.items) {
            setDocs(
              res.items.map((it: any) => ({
                title: it.title || it.slug,
                slug: it.slug
              }))
            )
          }
        }).catch(() => {})
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  // Build commands
  const allCommands: CommandItem[] = [
    // Actions
    {
      id: 'action-quick-capture',
      title: '빠른 캡처 (Quick Capture)',
      subtitle: '생각이나 아이디어를 즉시 수집함에 저장',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      action: () => {
        onClose()
        onOpenQuickCapture()
      },
      category: '액션'
    },
    {
      id: 'action-template',
      title: '템플릿으로 새 문서 생성',
      subtitle: '회의록, 기획서, 회고 등 템플릿 선택',
      icon: <LayoutTemplate className="w-4 h-4 text-primary" />,
      action: () => {
        onClose()
        onOpenTemplatePicker()
      },
      category: '액션'
    },
    // Views
    {
      id: 'view-inbox',
      title: '수집함 이동',
      subtitle: '새로 들어온 문서 확인',
      icon: <Inbox className="w-4 h-4 text-blue-500" />,
      action: () => {
        onSelectView('inbox')
        onClose()
      },
      category: '바로가기'
    },
    {
      id: 'view-today',
      title: '오늘 (Today) 이동',
      subtitle: '오늘 처리할 중요 문서 모음',
      icon: <Star className="w-4 h-4 text-amber-500" />,
      action: () => {
        onSelectView('today')
        onClose()
      },
      category: '바로가기'
    },
    {
      id: 'view-review',
      title: '검토 필요 이동',
      subtitle: '확인이 필요한 문서 목록',
      icon: <AlertCircle className="w-4 h-4 text-rose-500" />,
      action: () => {
        onSelectView('review')
        onClose()
      },
      category: '바로가기'
    },
    {
      id: 'view-library',
      title: '라이브러리 보드 이동',
      subtitle: '보드, 목록, 표, 갤러리 뷰',
      icon: <BookOpen className="w-4 h-4 text-purple-500" />,
      action: () => {
        onSelectView('library')
        onClose()
      },
      category: '바로가기'
    },
    {
      id: 'view-highlights',
      title: '하이라이트 & 메모 모음 이동',
      subtitle: '형광펜과 각주 모아보기',
      icon: <Highlighter className="w-4 h-4 text-amber-500" />,
      action: () => {
        onSelectView('highlights')
        onClose()
      },
      category: '바로가기'
    },
    {
      id: 'view-logbook',
      title: '기록 (Logbook) 이동',
      subtitle: '과거 활동 타임라인',
      icon: <Calendar className="w-4 h-4 text-emerald-500" />,
      action: () => {
        onSelectView('logbook')
        onClose()
      },
      category: '바로가기'
    },
    // Document Searches
    ...docs.map((d) => ({
      id: `doc-${d.slug}`,
      title: d.title,
      subtitle: `${d.slug}.md`,
      icon: <FileText className="w-4 h-4 text-primary" />,
      action: () => {
        onNavigateDocument(d.slug)
        onClose()
      },
      category: '문서' as const
    }))
  ]

  const filtered = allCommands.filter((c) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return c.title.toLowerCase().includes(q) || (c.subtitle && c.subtitle.toLowerCase().includes(q))
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-floating flex flex-col overflow-hidden max-h-[70vh] animate-in zoom-in-95 duration-100"
      >
        {/* Search Input */}
        <div className="px-4 py-3 border-b border-border/60 flex items-center gap-3 shrink-0 bg-sidebar-background/40">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="문서 검색, 뷰 이동, 또는 액션 실행 (Ctrl+K)..."
            className="w-full bg-transparent border-0 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto space-y-1 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              일치하는 항목이 없습니다.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                  idx === selectedIndex
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">{item.icon}</div>
                  <div className="truncate">
                    <div className="text-xs truncate">{item.title}</div>
                    {item.subtitle && (
                      <div
                        className={`text-[10px] truncate ${
                          idx === selectedIndex ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-2 ${
                    idx === selectedIndex
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border/50 bg-sidebar-background/30 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-3">
            <span>↑↓ 이동</span>
            <span>↵ 선택</span>
          </div>
          <span>MarkFlow Command Palette</span>
        </div>
      </div>
    </div>
  )
}
