import React from 'react'
import { Inbox, Sparkles } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = '수집함이 비어 있습니다',
  description = '새로 들어온 문서를 분류하고 Markdown으로 변환하세요.'
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12 select-none">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-4 shadow-subtle border border-border/50">
        <Inbox className="w-8 h-8 stroke-[1.5] text-primary/70" />
      </div>
      <h3 className="text-lg font-semibold text-foreground tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        {description}
      </p>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sidebar-background border border-border text-xs text-muted-foreground shadow-subtle">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span>Phase 2에서 파일 드래그 앤 드롭 변환이 활성화됩니다</span>
      </div>
    </div>
  )
}
