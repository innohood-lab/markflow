import React, { useEffect } from 'react'
import { RotateCcw, X, Trash2 } from 'lucide-react'

interface ToastUndoProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
  durationMs?: number
}

export const ToastUndo: React.FC<ToastUndoProps> = ({
  message,
  onUndo,
  onDismiss,
  durationMs = 6000
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [durationMs, onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-foreground text-background rounded-xl shadow-floating border border-border/20 text-xs animate-in fade-in slide-in-from-bottom-3 duration-fast select-none">
      <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
      <span className="font-medium">{message}</span>

      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover font-semibold transition-colors duration-fast active:scale-95"
      >
        <RotateCcw className="w-3 h-3" />
        <span>되돌리기</span>
      </button>

      <button
        onClick={onDismiss}
        className="p-1 text-background/60 hover:text-background rounded transition-colors ml-1"
        title="닫기"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
