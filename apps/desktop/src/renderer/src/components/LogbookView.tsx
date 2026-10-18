import React, { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Folder,
  Trash2,
  Share2,
  Clock,
  RotateCcw
} from 'lucide-react'

interface LogbookViewProps {
  onUndoDelete?: (id: number) => void
}

interface ExportLogItem {
  id: number
  conversion_id?: number
  target: string
  status: 'success' | 'failed'
  ref_or_path?: string
  error_message?: string
  created_at: string
}

interface TimelineEvent {
  id: string
  type: 'convert' | 'export'
  status: 'success' | 'failed' | 'review_needed'
  title: string
  subtitle: string
  timestamp: string
}

export const LogbookView: React.FC<LogbookViewProps> = () => {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [historyCount, setHistoryCount] = useState(0)
  const [exportCount, setExportCount] = useState(0)

  const loadLogbook = useCallback(async () => {
    if (window.markflowApi) {
      try {
        const hist = (await window.markflowApi.getHistory({ includeArchived: true })) || []
        setHistoryCount(hist.length)

        const exportLogs: ExportLogItem[] = window.markflowApi.getExportLogs
          ? (await window.markflowApi.getExportLogs(50)) || []
          : []
        setExportCount(exportLogs.length)

        const events: TimelineEvent[] = []
        for (const h of hist.slice(0, 40)) {
          events.push({
            id: `conv-${h.id || h.slug}`,
            type: 'convert',
            status: h.status === 'review_needed' ? 'review_needed' : 'success',
            title: `문서 변환 완료: ${h.title || h.slug}`,
            subtitle: `원본: ${h.source_file} (${(h.source_type || 'md').toUpperCase()}) · 품질 점수: ${h.quality_score ?? '-'}점`,
            timestamp: h.converted_at || h.created_at || new Date().toISOString()
          })
        }

        for (const exp of exportLogs) {
          events.push({
            id: `exp-${exp.id}`,
            type: 'export',
            status: exp.status === 'failed' ? 'failed' : 'success',
            title:
              exp.status === 'success'
                ? `${exp.target.toUpperCase()} 내보내기 성공`
                : `${exp.target.toUpperCase()} 내보내기 실패`,
            subtitle: exp.error_message || exp.ref_or_path || '외부 지식 저장소 동기화 작업',
            timestamp: exp.created_at || new Date().toISOString()
          })
        }

        events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        setTimelineEvents(events)
      } catch (err) {
        console.error('[LogbookView] Failed to load logbook:', err)
      }
    }
  }, [])

  useEffect(() => {
    loadLogbook()
  }, [loadLogbook])

  const formatDateGroup = (isoStr: string) => {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return '오늘'
    const today = new Date()
    if (d.toDateString() === today.toDateString()) {
      return '오늘'
    }
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) {
      return '어제'
    }
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(d)
  }

  const groupedEvents: Record<string, TimelineEvent[]> = {}
  for (const ev of timelineEvents) {
    const grp = formatDateGroup(ev.timestamp)
    if (!groupedEvents[grp]) groupedEvents[grp] = []
    groupedEvents[grp].push(ev)
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 select-none bg-background">
      <div className="mb-6 app-drag-region">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>기록 (Logbook)</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          변환 완료, 내보내기 전송, 상태 변경 등 모든 지식 관리 작업 이력입니다.
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border/60 bg-card shadow-subtle">
            <span className="text-xs text-muted-foreground">보관 문서 총합</span>
            <div className="text-2xl font-bold text-foreground mt-1">{historyCount}건</div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-card shadow-subtle">
            <span className="text-xs text-muted-foreground">누적 내보내기 이력</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {exportCount > 0 ? `${exportCount}건` : 'GitHub & Obsidian'}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-card shadow-subtle">
            <span className="text-xs text-muted-foreground">자동 수집 감시</span>
            <div className="text-2xl font-bold text-primary mt-1">실시간 활성화</div>
          </div>
        </div>

        {/* Timeline Log Section */}
        {Object.keys(groupedEvents).length === 0 ? (
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              최근 작업 타임라인
            </h3>

            <div className="border border-border/60 rounded-xl divide-y divide-border/40 bg-card overflow-hidden shadow-subtle">
              <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      노션형 보드 색인 및 변환 엔진 준비 완료
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      SQLite FTS5 트라이그램 전문 검색 및 Frontmatter 그룹 체계 동기화 대기 중
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">방금 전</span>
              </div>
            </div>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>{dateLabel}</span>
                <span className="text-[10px] font-mono text-muted-foreground/70">({items.length})</span>
              </h3>

              <div className="border border-border/60 rounded-xl divide-y divide-border/40 bg-card overflow-hidden shadow-subtle">
                {items.map((ev) => (
                  <div key={ev.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          ev.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : ev.status === 'review_needed'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : ev.type === 'export'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {ev.status === 'failed' || ev.status === 'review_needed' ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : ev.type === 'export' ? (
                          <Share2 className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground block truncate">{ev.title}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{ev.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                      {ev.timestamp ? ev.timestamp.slice(11, 16) || '오늘' : '오늘'}
                    </span>
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
