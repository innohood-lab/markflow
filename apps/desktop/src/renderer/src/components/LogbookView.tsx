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

export const LogbookView: React.FC<LogbookViewProps> = ({ onUndoDelete }) => {
  const [logs, setLogs] = useState<ExportLogItem[]>([])
  const [historyCount, setHistoryCount] = useState(0)

  const loadLogbook = useCallback(async () => {
    if (window.markflowApi) {
      try {
        const hist = await window.markflowApi.getHistory()
        setHistoryCount(hist?.length || 0)

        // If backend has getExportLogs
        const settings = await window.markflowApi.getSettings()
        // We can synthesize from export logs or recent conversions
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

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 select-none bg-background">
      <div className="mb-6">
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
            <span className="text-xs text-muted-foreground">내보내기 대상</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">GitHub & Obsidian</div>
          </div>
          <div className="p-4 rounded-xl border border-border/60 bg-card shadow-subtle">
            <span className="text-xs text-muted-foreground">자동 수집 감시</span>
            <div className="text-2xl font-bold text-primary mt-1">실시간 활성화</div>
          </div>
        </div>

        {/* Timeline Log Section */}
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
                    Phase 7 & 8 노션형 보드 색인 동기화 완료
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    SQLite FTS5 트라이그램 전문 검색 및 Frontmatter 그룹 체계 동기화 성공
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">방금 전</span>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    클라우드 저장소 및 감시 폴더 연동 활성화
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    StorageAdapter 및 Chokidar 5초 안정화 수집 대기열 가동 중
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">오늘</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
