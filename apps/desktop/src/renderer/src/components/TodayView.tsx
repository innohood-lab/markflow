import React, { useState, useEffect, useCallback } from 'react'
import { ConversionRecord } from '../../../preload'
import {
  Star,
  Inbox,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Plus
} from 'lucide-react'

interface TodayViewProps {
  onOpenDetail: (doc: ConversionRecord) => void
  onExport: (target: 'github' | 'obsidian' | 'both', itemIds: number[]) => void
}

export const TodayView: React.FC<TodayViewProps> = ({ onOpenDetail, onExport }) => {
  const [documents, setDocuments] = useState<ConversionRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadTodayDocuments = useCallback(async () => {
    if (!window.markflowApi) return
    setIsLoading(true)
    try {
      const docs = await window.markflowApi.getBoardDocuments({
        todayOnly: true
      })
      setDocuments(docs || [])
    } catch (err) {
      console.error('[TodayView] Failed to load today documents:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTodayDocuments()
  }, [loadTodayDocuments])

  const handleToggleStar = async (id?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!id || !window.markflowApi?.toggleStarDocument) return
    await window.markflowApi.toggleStarDocument(id)
    loadTodayDocuments()
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const starredDocs = documents.filter((d) => d.is_starred === 1)
  const todayConvertedDocs = documents.filter(
    (d) => d.converted_at && d.converted_at.startsWith(todayStr) && d.is_starred !== 1
  )
  const reviewNeededDocs = documents.filter(
    (d) =>
      (d.status === 'review_needed' || (d.quality_score !== null && d.quality_score !== undefined && d.quality_score < 70)) &&
      d.is_starred !== 1 &&
      !(d.converted_at && d.converted_at.startsWith(todayStr))
  )

  const renderDocRow = (doc: ConversionRecord) => {
    return (
      <div
        key={doc.slug}
        onClick={() => onOpenDetail(doc)}
        className="group px-4 py-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-border transition-colors flex items-center justify-between gap-3 cursor-pointer select-none shadow-subtle"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Star Toggle */}
          <button
            onClick={(e) => handleToggleStar(doc.id, e)}
            className={`p-1 rounded-md transition-colors ${
              doc.is_starred
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-muted-foreground/40 hover:text-amber-500 hover:bg-muted'
            }`}
            title={doc.is_starred ? '오늘 볼 문서에서 제외' : '오늘 볼 문서로 고정 (Star)'}
          >
            <Star className={`w-4 h-4 ${doc.is_starred ? 'fill-amber-500' : ''}`} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight truncate group-hover:text-primary">
                {doc.title || doc.slug}
              </span>
              {doc.category && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground font-medium shrink-0">
                  {doc.category}
                </span>
              )}
            </div>
            {doc.tags && doc.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                {doc.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] text-muted-foreground">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Info */}
        <div className="flex items-center gap-3 shrink-0">
          {doc.quality_score !== null && doc.quality_score !== undefined && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
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

          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    )
  }

  const todayFormatted = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 select-none bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>오늘</span>
          <span className="text-xs font-normal text-muted-foreground">({todayFormatted})</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          오늘 확인해야 할 핵심 문서와 새로 수집된 지식 목록입니다.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border/60 rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mb-2" />
          <h3 className="text-sm font-semibold text-foreground mb-1">
            오늘 할 일이 모두 정리되었습니다!
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            문서 목록에서 별표(Star)를 누르면 언제든지 오늘 볼 문서로 고정할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* Section 1: Starred Docs */}
          {starredDocs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-foreground tracking-tight">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>오늘 볼 문서 (고정됨)</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-border/60 text-muted-foreground">
                  {starredDocs.length}
                </span>
              </div>
              <div className="space-y-2">{starredDocs.map(renderDocRow)}</div>
            </div>
          )}

          {/* Section 2: Today's Converted Docs */}
          {todayConvertedDocs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-foreground tracking-tight">
                <Inbox className="w-3.5 h-3.5 text-blue-500" />
                <span>오늘 새로 들어온 문서</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-border/60 text-muted-foreground">
                  {todayConvertedDocs.length}
                </span>
              </div>
              <div className="space-y-2">{todayConvertedDocs.map(renderDocRow)}</div>
            </div>
          )}

          {/* Section 3: Review Needed Docs */}
          {reviewNeededDocs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-foreground tracking-tight">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>품질 검토 필요 문서</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-border/60 text-muted-foreground">
                  {reviewNeededDocs.length}
                </span>
              </div>
              <div className="space-y-2">{reviewNeededDocs.map(renderDocRow)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
