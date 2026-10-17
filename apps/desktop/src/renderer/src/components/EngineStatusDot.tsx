import React, { useState } from 'react'
import { EngineStatus } from '../../../preload'
import { RotateCw, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface EngineStatusDotProps {
  status: EngineStatus
  onRetry?: () => void
}

export const EngineStatusDot: React.FC<EngineStatusDotProps> = ({ status, onRetry }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  // Color mapping
  const getDotColor = () => {
    switch (status.state) {
      case 'ready':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
      case 'starting':
        return 'bg-amber-400 animate-pulse'
      case 'error':
        return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
      case 'stopped':
      default:
        return 'bg-slate-400'
    }
  }

  const getStatusLabel = () => {
    switch (status.state) {
      case 'ready':
        return '변환 엔진 정상 작동 중'
      case 'starting':
        return '변환 엔진 구동 중...'
      case 'error':
        return '엔진 연결 실패'
      case 'stopped':
        return '엔진 중지됨'
    }
  }

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-sidebar-accent cursor-pointer transition-colors duration-fast">
        <span className={`w-2.5 h-2.5 rounded-full ${getDotColor()} transition-colors duration-normal`} />
        <span className="text-xs text-muted-foreground font-medium">
          {status.state === 'ready'
            ? `엔진 v${status.version || '0.1'}`
            : status.state === 'starting'
            ? '시작 중...'
            : '엔진 오프라인'}
        </span>
      </div>

      {/* Hover Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border border-border shadow-floating rounded-lg p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-fast">
          <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1.5">
            {status.state === 'ready' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : status.state === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <RotateCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
            )}
            <span>{getStatusLabel()}</span>
          </div>

          <div className="space-y-1 text-muted-foreground text-[11px]">
            {status.port && (
              <div className="flex justify-between">
                <span>포트:</span>
                <span className="font-mono text-foreground">{status.port} (127.0.0.1)</span>
              </div>
            )}
            {status.markitdownVersion && (
              <div className="flex justify-between">
                <span>MarkItDown:</span>
                <span className="font-mono text-foreground">v{status.markitdownVersion}</span>
              </div>
            )}
            {status.error && (
              <div className="mt-1 text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-200 dark:border-rose-900 leading-relaxed">
                {status.error}
              </div>
            )}
          </div>

          {status.state === 'error' && onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRetry()
              }}
              className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              엔진 재시작
            </button>
          )}
        </div>
      )}
    </div>
  )
}
