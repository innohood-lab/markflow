import React, { useState } from 'react'
import { ConversionRecord } from '../../../../preload'
import {
  Inbox,
  AlertCircle,
  CheckCircle2,
  Archive,
  MoreVertical,
  Copy,
  Trash2
} from 'lucide-react'

interface BoardKanbanViewProps {
  documents: ConversionRecord[]
  onOpenDetail: (doc: ConversionRecord) => void
  onUpdateFrontmatter: (slug: string, updates: Record<string, any>) => void
  onDuplicate: (slug: string) => void
  onDelete: (id: number) => void
}

interface ColumnDef {
  id: string
  title: string
  icon: any
  statusMatch: (status?: string) => boolean
  targetStatus: string
  headerBg: string
  dotColor: string
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'inbox',
    title: '수집함',
    icon: Inbox,
    statusMatch: (s) => s === 'inbox' || !s,
    targetStatus: 'inbox',
    headerBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500'
  },
  {
    id: 'review_needed',
    title: '검토 필요',
    icon: AlertCircle,
    statusMatch: (s) => s === 'review_needed',
    targetStatus: 'review_needed',
    headerBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500'
  },
  {
    id: 'ready',
    title: '완료',
    icon: CheckCircle2,
    statusMatch: (s) => s === 'ready' || s === 'exported' || s === 'done',
    targetStatus: 'ready',
    headerBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500'
  },
  {
    id: 'archived',
    title: '보관됨',
    icon: Archive,
    statusMatch: (s) => s === 'archived',
    targetStatus: 'archived',
    headerBg: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    dotColor: 'bg-gray-400'
  }
]

export const BoardKanbanView: React.FC<BoardKanbanViewProps> = ({
  documents,
  onOpenDetail,
  onUpdateFrontmatter,
  onDuplicate,
  onDelete
}) => {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, slug: string) => {
    e.dataTransfer.setData('text/plain', slug)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingSlug(slug)
  }

  const handleDragEnd = () => {
    setDraggingSlug(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId)
    }
  }

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const slug = e.dataTransfer.getData('text/plain') || draggingSlug
    if (slug) {
      onUpdateFrontmatter(slug, { status: targetStatus })
    }
    setDragOverColumn(null)
    setDraggingSlug(null)
  }

  return (
    <div className="flex-1 overflow-x-auto p-6 flex gap-4 select-none items-start">
      {COLUMNS.map((col) => {
        const colDocs = documents.filter((d) => col.statusMatch(d.status))
        const isOver = dragOverColumn === col.id
        const Icon = col.icon

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(e, col.targetStatus)}
            className={`w-72 shrink-0 bg-muted/30 rounded-xl border flex flex-col max-h-full transition-colors duration-fast ${
              isOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border/60'
            }`}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className="font-semibold text-xs text-foreground tracking-tight">
                  {col.title}
                </span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-border/60 text-muted-foreground font-semibold">
                  {colDocs.length}
                </span>
              </div>
            </div>

            {/* Cards List */}
            <div className="p-2 space-y-2 overflow-y-auto flex-1 min-h-[160px]">
              {colDocs.map((doc) => {
                const isDragging = draggingSlug === doc.slug

                return (
                  <div
                    key={doc.slug}
                    draggable
                    onDragStart={(e) => handleDragStart(e, doc.slug)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onOpenDetail(doc)}
                    className={`bg-card p-3 rounded-lg border border-border/70 shadow-subtle hover:border-border hover:shadow-floating cursor-grab active:cursor-grabbing transition-all ${
                      isDragging ? 'opacity-40 scale-95 border-dashed border-primary' : ''
                    }`}
                  >
                    {/* Card Top: Category & Quality Score */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      {doc.category ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground font-medium">
                          {doc.category}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 uppercase font-mono">
                          {doc.source_type}
                        </span>
                      )}

                      {doc.quality_score !== null && doc.quality_score !== undefined && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                            doc.quality_score >= 85
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : doc.quality_score >= 70
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {doc.quality_score}점
                        </span>
                      )}
                    </div>

                    {/* Card Title */}
                    <h4 className="text-xs font-semibold text-foreground tracking-tight line-clamp-2 mb-2 hover:text-primary">
                      {doc.title || doc.slug}
                    </h4>

                    {/* Card Bottom: Tags & Date */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                      <div className="flex items-center gap-1 overflow-hidden">
                        {doc.tags && doc.tags.length > 0 ? (
                          doc.tags.slice(0, 2).map((t) => (
                            <span key={t} className="truncate max-w-[60px]">
                              #{t}
                            </span>
                          ))
                        ) : (
                          <span>태그 없음</span>
                        )}
                      </div>
                      <span>{doc.converted_at ? doc.converted_at.split('T')[0] : ''}</span>
                    </div>
                  </div>
                )
              })}

              {colDocs.length === 0 && (
                <div className="h-24 flex items-center justify-center border border-dashed border-border/60 rounded-lg text-muted-foreground text-xs">
                  카드를 여기로 드래그
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
