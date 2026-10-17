import React, { useState } from 'react'
import { Tag as TagIcon, Layers, FileText, CheckCircle2, AlertCircle, Inbox, Plus, X } from 'lucide-react'

export interface FrontmatterData {
  title: string
  status: string
  tags: string[]
  category: string
  groups?: string[]
}

interface FrontmatterFormProps {
  data: FrontmatterData
  onChange: (updated: FrontmatterData) => void
  qualityScore?: number | null
}

export const FrontmatterForm: React.FC<FrontmatterFormProps> = ({
  data,
  onChange,
  qualityScore
}) => {
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, '')
    if (trimmed && !data.tags.includes(trimmed)) {
      onChange({ ...data, tags: [...data.tags, trimmed] })
    }
    setNewTagInput('')
    setIsAddingTag(false)
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onChange({ ...data, tags: data.tags.filter((t) => t !== tagToRemove) })
  }

  return (
    <div className="p-4 bg-sidebar-background/40 border-b border-border/60 select-none space-y-3 shrink-0">
      {/* Title Input */}
      <div>
        <input
          type="text"
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder="문서 제목 입력..."
          className="w-full text-lg font-bold bg-transparent border-0 border-b border-transparent hover:border-border/80 focus:border-primary focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60 px-0 py-1 transition-colors"
        />
      </div>

      {/* Properties Grid (Notion style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Status Property */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground w-20 shrink-0">
            <Layers className="w-3.5 h-3.5" />
            <span>상태</span>
          </div>
          <select
            value={data.status === 'done' ? 'ready' : (data.status || 'inbox')}
            onChange={(e) => onChange({ ...data, status: e.target.value })}
            className="flex-1 bg-card border border-border/80 rounded-md px-2 py-1 text-xs text-foreground cursor-pointer focus:outline-none focus:border-primary font-medium shadow-subtle"
          >
            <option value="inbox">📥 수집함 (Inbox)</option>
            <option value="review_needed">⚠ 검토 필요 (Review)</option>
            <option value="ready">✓ 준비 완료 (Ready)</option>
            <option value="exported">📤 내보냄 (Exported)</option>
            <option value="archived">📦 보관됨 (Archived)</option>
          </select>
        </div>

        {/* Category Property */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground w-20 shrink-0">
            <FileText className="w-3.5 h-3.5" />
            <span>카테고리</span>
          </div>
          <input
            type="text"
            value={data.category || ''}
            onChange={(e) => onChange({ ...data, category: e.target.value })}
            placeholder="카테고리 입력..."
            className="flex-1 bg-card border border-border/80 rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary shadow-subtle"
          />
        </div>

        {/* Quality Score Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground w-20 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>품질 점수</span>
          </div>
          <div>
            {qualityScore !== undefined && qualityScore !== null ? (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  qualityScore >= 85
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : qualityScore >= 70
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}
              >
                {qualityScore}점 ({qualityScore >= 85 ? '우수' : qualityScore >= 70 ? '양호' : '검토 권장'})
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        </div>
      </div>

      {/* Tags Section */}
      <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground w-20 shrink-0">
          <TagIcon className="w-3.5 h-3.5" />
          <span>태그</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium"
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-rose-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {isAddingTag ? (
            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTag()
                  if (e.key === 'Escape') setIsAddingTag(false)
                }}
                onBlur={handleAddTag}
                placeholder="태그 입력..."
                className="w-24 px-1.5 py-0.5 rounded border border-primary text-xs bg-card text-foreground focus:outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingTag(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors shadow-subtle"
            >
              <Plus className="w-3 h-3" />
              <span>태그 추가</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
