import React from 'react'
import { ConversionRecord } from '../../../preload'
import { Search, ArrowUpDown, FileText, CheckCircle, ExternalLink, Trash2 } from 'lucide-react'

interface HistorySectionProps {
  items: ConversionRecord[]
  selectedItem: ConversionRecord | null
  onSelectItem: (item: ConversionRecord) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  sortOrder: 'latest' | 'name'
  onSortChange: (sort: 'latest' | 'name') => void
  onDelete: (id: number) => void
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  items,
  selectedItem,
  onSelectItem,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  onDelete
}) => {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background select-none">
      {/* Top Search & Filter Bar */}
      <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between gap-3 shrink-0 bg-sidebar-background/30">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="제목 또는 파일명 검색..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-card border border-border/80 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all"
          />
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as 'latest' | 'name')}
            className="text-xs bg-card border border-border/80 rounded-lg px-2 py-1.5 text-foreground cursor-pointer focus:outline-none focus:border-primary"
          >
            <option value="latest">최신순</option>
            <option value="name">이름순</option>
          </select>
        </div>
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs">
            <FileText className="w-8 h-8 stroke-[1.2] text-muted-foreground/40 mb-2" />
            <p>변환된 문서 내역이 없습니다</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              왼쪽 대기열에 파일을 끌어놓아 변환해 보세요
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedItem?.id === item.id
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-fast border ${
                  isSelected
                    ? 'bg-sidebar-accent border-primary/40 shadow-subtle'
                    : 'bg-card border-border/60 hover:border-border hover:bg-muted/40'
                }`}
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {item.source_type}
                    </span>
                    <h3
                      className={`text-xs font-semibold truncate ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                    <span>{item.source_file}</span>
                    <span>·</span>
                    <span>{item.converted_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </div>

                {/* Right badges & delete button */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sidebar-background border border-border text-muted-foreground">
                    {item.status || '미분류'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
