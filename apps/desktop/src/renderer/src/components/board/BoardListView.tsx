import React from 'react'
import { ConversionRecord } from '../../../../preload'
import {
  FileText,
  Copy,
  Archive,
  Trash2,
  ExternalLink,
  ChevronRight
} from 'lucide-react'

interface BoardListViewProps {
  documents: ConversionRecord[]
  selectedSlugs: Set<string>
  onToggleSelect: (slug: string) => void
  onOpenDetail: (doc: ConversionRecord) => void
  onDuplicate: (slug: string) => void
  onArchive: (slug: string, isArchived: boolean) => void
  onDelete: (id: number) => void
}

export const BoardListView: React.FC<BoardListViewProps> = ({
  documents,
  selectedSlugs,
  onToggleSelect,
  onOpenDetail,
  onDuplicate,
  onArchive,
  onDelete
}) => {
  const getStatusDotColor = (status?: string) => {
    switch (status) {
      case 'ready':
      case 'exported':
        return 'bg-emerald-500'
      case 'review_needed':
        return 'bg-amber-500'
      case 'archived':
        return 'bg-gray-400'
      default:
        return 'bg-blue-500' // inbox
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'ready':
        return '준비 완료'
      case 'exported':
        return '내보냄'
      case 'review_needed':
        return '검토 필요'
      case 'archived':
        return '보관됨'
      default:
        return '수집함'
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-3 divide-y divide-border/40 select-none">
      {documents.map((doc) => {
        const isSelected = selectedSlugs.has(doc.slug)
        const isArchived = doc.status === 'archived'

        return (
          <div
            key={doc.slug}
            className={`group py-2.5 px-3 rounded-lg flex items-center justify-between gap-3 transition-colors duration-fast ${
              isSelected
                ? 'bg-primary/5 hover:bg-primary/10'
                : 'hover:bg-muted/50'
            }`}
          >
            {/* Left: Checkbox + Status dot + Title + Category + Tags */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(doc.slug)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-border text-primary focus:ring-0 cursor-pointer"
              />

              <div
                className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(doc.status)}`}
                title={`상태: ${getStatusLabel(doc.status)}`}
              />

              <div
                onClick={() => onOpenDetail(doc)}
                className="cursor-pointer min-w-0 flex-1 flex items-center gap-2"
              >
                <span className={`text-sm font-medium tracking-tight truncate ${
                  isArchived ? 'line-through text-muted-foreground' : 'text-foreground hover:text-primary'
                }`}>
                  {doc.title || doc.slug}
                </span>

                {doc.category && (
                  <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-secondary/70 text-secondary-foreground font-medium border border-border/40">
                    {doc.category}
                  </span>
                )}

                {doc.tags && doc.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1 shrink-0 overflow-hidden">
                    {doc.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{doc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Date, Score Badge, Hover Action Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground hidden md:inline">
                {doc.converted_at ? doc.converted_at.split('T')[0] : ''}
              </span>

              {doc.quality_score !== null && doc.quality_score !== undefined && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    doc.quality_score >= 85
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : doc.quality_score >= 70
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                  title={`품질 점수: ${doc.quality_score}점`}
                >
                  {doc.quality_score}점
                </span>
              )}

              {/* Hover Quick Action Icons */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  onClick={() => onDuplicate(doc.slug)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="문서 복제"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onArchive(doc.slug, !isArchived)}
                  className={`p-1 rounded hover:bg-muted ${
                    isArchived ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={isArchived ? '보관 해제' : '문서 보관'}
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                {doc.id && (
                  <button
                    onClick={() => onDelete(doc.id!)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="문서 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onOpenDetail(doc)}
                  className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted"
                  title="상세 보기"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
