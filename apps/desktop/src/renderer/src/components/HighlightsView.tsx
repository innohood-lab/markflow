import React, { useState, useEffect } from 'react'
import { Highlighter, MessageSquare, Search, FileText, ExternalLink, RefreshCw } from 'lucide-react'

interface HighlightItem {
  slug: string
  title: string
  text: string
  type: 'highlight' | 'note'
  note?: string
}

interface HighlightsViewProps {
  onNavigateDocument: (slugOrTitle: string) => void
}

export const HighlightsView: React.FC<HighlightsViewProps> = ({ onNavigateDocument }) => {
  const [items, setItems] = useState<HighlightItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'highlight' | 'note'>('all')

  const loadHighlights = async () => {
    setLoading(true)
    try {
      if (window.markflowApi?.getAllHighlights) {
        const res = await window.markflowApi.getAllHighlights()
        setItems(res || [])
      }
    } catch (err) {
      console.warn('[HighlightsView] Error loading highlights:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHighlights()
  }, [])

  const filteredItems = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      item.text.toLowerCase().includes(q) ||
      (item.note && item.note.toLowerCase().includes(q))
    )
  })

  // Group by document
  const groupedByDoc: Record<string, HighlightItem[]> = {}
  for (const it of filteredItems) {
    if (!groupedByDoc[it.title]) {
      groupedByDoc[it.title] = []
    }
    groupedByDoc[it.title].push(it)
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-border/60 bg-sidebar-background/40 flex items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Highlighter className="w-5 h-5 text-amber-500" />
            <h1 className="text-lg font-bold text-foreground">하이라이트 & 메모 모음</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            라이브러리 전체 문서의 형광펜(==...==) 및 각주 메모를 한곳에서 검토합니다.
          </p>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={loadHighlights}
          className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="새로고침"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 border-b border-border/50 bg-card/60 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="하이라이트 또는 메모 검색..."
            className="w-full text-xs bg-transparent border-0 focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              filterType === 'all'
                ? 'bg-card text-foreground shadow-subtle font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            전체 ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('highlight')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              filterType === 'highlight'
                ? 'bg-card text-foreground shadow-subtle font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Highlighter className="w-3 h-3 text-amber-500" />
            <span>형광펜</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('note')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
              filterType === 'note'
                ? 'bg-card text-foreground shadow-subtle font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-3 h-3 text-primary" />
            <span>메모</span>
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-xs">
            하이라이트를 불러오는 중입니다...
          </div>
        ) : Object.keys(groupedByDoc).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground select-none">
            <Highlighter className="w-10 h-10 stroke-[1.2] text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">등록된 하이라이트나 메모가 없습니다</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              문서 미리보기에서 텍스트를 드래그하여 하이라이트 또는 메모를 남겨보세요.
            </p>
          </div>
        ) : (
          Object.entries(groupedByDoc).map(([docTitle, docItems]) => (
            <div key={docTitle} className="space-y-2.5">
              {/* Document Header */}
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">{docTitle}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    ({docItems.length}개)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateDocument(docItems[0].slug || docTitle)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                >
                  <span>문서 열기</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Items under this document */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {docItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onNavigateDocument(item.slug || docTitle)}
                    className="p-3 rounded-xl bg-card border border-border shadow-subtle hover:border-primary/40 hover:shadow-float transition-all cursor-pointer flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {item.type === 'highlight' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Highlighter className="w-2.5 h-2.5" />
                            <span>형광펜</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            <MessageSquare className="w-2.5 h-2.5" />
                            <span>각주 메모</span>
                          </span>
                        )}
                      </div>

                      {/* Highlighted text quote */}
                      <blockquote className="text-xs text-foreground font-medium border-l-2 border-amber-400/80 pl-2.5 italic my-1">
                        &quot;{item.text}&quot;
                      </blockquote>

                      {/* Note text if present */}
                      {item.note && (
                        <div className="mt-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/50">
                          <span className="font-semibold text-foreground/80 mr-1">메모:</span>
                          {item.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
