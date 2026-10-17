import React, { useState } from 'react'
import { ConversionRecord } from '../../../preload'
import { FolderOpen, Copy, Check, Trash2, FileText, Calendar, HardDrive } from 'lucide-react'

interface MarkdownPreviewProps {
  item: ConversionRecord | null
  onDelete: (id: number) => void
  onCopySuccess?: () => void
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ item, onDelete }) => {
  const [copied, setCopied] = useState(false)

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 select-none">
        <FileText className="w-10 h-10 stroke-[1.2] text-muted-foreground/40 mb-2" />
        <p className="text-sm">변환 내역에서 문서를 선택하면 미리보기가 표시됩니다</p>
      </div>
    )
  }

  const handleCopy = async () => {
    if (item.markdown && window.markflowApi) {
      await window.markflowApi.copyToClipboard(item.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShowInFolder = () => {
    if (item.library_path && window.markflowApi) {
      window.markflowApi.showItemInFolder(item.library_path)
    }
  }

  // Parse frontmatter vs body
  let frontmatterText = ''
  let bodyText = item.markdown || ''
  if (bodyText.startsWith('---')) {
    const parts = bodyText.split('---')
    if (parts.length >= 3) {
      frontmatterText = parts[1].trim()
      bodyText = parts.slice(2).join('---').trim()
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Top Header & Actions Bar */}
      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-4 shrink-0 bg-sidebar-background/40">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              {item.source_type}
            </span>
            <h2 className="text-base font-bold text-foreground truncate" title={item.title}>
              {item.title}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <HardDrive className="w-3 h-3" />
              {item.slug}.md ({formatFileSize(item.file_size)})
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <Calendar className="w-3 h-3" />
              {item.converted_at?.slice(0, 16).replace('T', ' ')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleShowInFolder}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-foreground bg-card hover:bg-muted border border-border shadow-subtle transition-colors"
            title="파일 탐색기(Finder)에서 열기"
          >
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span>탐색기</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-foreground bg-card hover:bg-muted border border-border shadow-subtle transition-colors"
            title="전체 Markdown 복사"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 font-semibold">복사됨!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>MD 복사</span>
              </>
            )}
          </button>

          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-colors"
            title="삭제 (휴지통으로 이동)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
        {/* Frontmatter display (Notion property style) */}
        {frontmatterText && (
          <div className="p-3 rounded-lg bg-sidebar-background border border-border/70 text-xs font-mono text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground/80 mb-1 font-sans text-[11px] uppercase tracking-wider flex items-center gap-1">
              <span>YAML Frontmatter</span>
            </div>
            <pre className="whitespace-pre-wrap leading-relaxed overflow-x-auto text-[11px]">
              {frontmatterText}
            </pre>
          </div>
        )}

        {/* Rendered Markdown Body */}
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap font-sans">
          {bodyText || <span className="text-muted-foreground italic">내용이 비어 있습니다.</span>}
        </div>
      </div>
    </div>
  )
}
