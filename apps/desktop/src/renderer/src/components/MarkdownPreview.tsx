import React, { useState, useEffect, useRef } from 'react'
import { ConversionRecord } from '../../../preload'
import { FolderOpen, Copy, Check, Trash2, FileText, Calendar, HardDrive, Highlighter, MessageSquare, X } from 'lucide-react'

interface MarkdownPreviewProps {
  item: ConversionRecord | null
  onDelete: (id: number) => void
  onCopySuccess?: () => void
  onNavigateDocument?: (docTitleOrSlug: string) => void
  onDocumentUpdated?: (newMarkdown: string) => void
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  item,
  onDelete,
  onNavigateDocument,
  onDocumentUpdated
}) => {
  const [copied, setCopied] = useState(false)
  const [currentMarkdown, setCurrentMarkdown] = useState<string>(item?.markdown || '')

  // Floating highlight/note popover state
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [noteInputOpen, setNoteInputOpen] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})

  const contentAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrentMarkdown(item?.markdown || '')
  }, [item?.markdown])

  useEffect(() => {
    let active = true
    const md = currentMarkdown || ''
    const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
    const pathsToResolve: string[] = []
    let m: RegExpExecArray | null
    while ((m = imgRegex.exec(md)) !== null) {
      const src = m[1].trim()
      if (src.startsWith('assets/') && !assetUrls[src]) {
        pathsToResolve.push(src)
      }
    }
    if (pathsToResolve.length > 0 && window.markflowApi?.getAssetDataUrl) {
      Promise.all(
        pathsToResolve.map(async (relPath) => {
          try {
            const url = await window.markflowApi.getAssetDataUrl(relPath)
            return [relPath, url] as const
          } catch {
            return [relPath, null] as const
          }
        })
      ).then((entries) => {
        if (!active) return
        const next: Record<string, string> = {}
        for (const [k, v] of entries) {
          if (v) next[k] = v
        }
        if (Object.keys(next).length > 0) {
          setAssetUrls((prev) => ({ ...prev, ...next }))
        }
      })
    }
    return () => {
      active = false
    }
  }, [currentMarkdown])

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 select-none">
        <FileText className="w-10 h-10 stroke-[1.2] text-muted-foreground/40 mb-2" />
        <p className="text-sm">변환 내역에서 문서를 선택하면 미리보기가 표시됩니다</p>
      </div>
    )
  }

  const handleCopy = async () => {
    if (currentMarkdown && window.markflowApi) {
      await window.markflowApi.copyToClipboard(currentMarkdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShowInFolder = () => {
    if (item.library_path && window.markflowApi) {
      window.markflowApi.showItemInFolder(item.library_path)
    }
  }

  // Handle text selection in content area
  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      if (!noteInputOpen) {
        setPopoverPos(null)
        setSelectedText('')
      }
      return
    }

    const text = selection.toString().trim()
    if (text.length > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectedText(text)
      setPopoverPos({
        x: rect.left + rect.width / 2,
        y: Math.max(10, rect.top - 46)
      })
    }
  }

  const handleAddHighlight = async () => {
    if (!item.library_path || !selectedText) return
    if (window.markflowApi?.addHighlight) {
      const res = await window.markflowApi.addHighlight(item.library_path, selectedText)
      if (res.success && res.markdown) {
        setCurrentMarkdown(res.markdown)
        onDocumentUpdated?.(res.markdown)
        setPopoverPos(null)
        setSelectedText('')
        showToast('하이라이트가 추가되었습니다.')
      }
    }
  }

  const handleSaveNote = async () => {
    if (!item.library_path || !selectedText || !noteContent.trim()) return
    if (window.markflowApi?.addFootnoteNote) {
      const res = await window.markflowApi.addFootnoteNote(
        item.library_path,
        selectedText,
        noteContent.trim()
      )
      if (res.success && res.markdown) {
        setCurrentMarkdown(res.markdown)
        onDocumentUpdated?.(res.markdown)
        setNoteInputOpen(false)
        setNoteContent('')
        setPopoverPos(null)
        setSelectedText('')
        showToast('메모가 각주 형태로 추가되었습니다.')
      }
    }
  }

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg)
    setTimeout(() => setActionSuccessMsg(null), 2500)
  }

  // Parse frontmatter vs body
  let frontmatterText = ''
  let bodyText = currentMarkdown || ''
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

  // Interactive parser for [[Wiki Links]], ==Highlights==, [^Footnotes], and ![Images](src)
  const renderInteractiveMarkdown = (text: string) => {
    if (!text) return null
    // Tokenize lines
    const lines = text.split('\n')
    return lines.map((line, lineIdx) => {
      // Regex tokens: ![alt](src), [[Wiki Link]], ==Highlight==, or [^Footnote]
      const tokenRegex = /(!\[[^\]]*\]\([^)]+\)|\[\[[^\]]+\]\]|==[^=]+==|\[\^[^\]]+\])/g
      const parts = line.split(tokenRegex)

      return (
        <React.Fragment key={lineIdx}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('![') && part.includes('](') && part.endsWith(')')) {
              const match = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
              if (match) {
                const altText = match[1] || '추출된 이미지'
                const rawSrc = match[2].trim()
                const resolvedSrc = assetUrls[rawSrc] || (rawSrc.startsWith('data:') || rawSrc.startsWith('http') ? rawSrc : null)
                if (resolvedSrc) {
                  return (
                    <span key={pIdx} className="block my-3">
                      <img
                        src={resolvedSrc}
                        alt={altText}
                        className="max-w-full max-h-[420px] rounded-xl border border-border/70 shadow-subtle object-contain bg-card"
                      />
                      {altText && (
                        <span className="block text-[11px] text-muted-foreground mt-1">
                          {altText}
                        </span>
                      )}
                    </span>
                  )
                }
              }
            } else if (part.startsWith('[[') && part.endsWith(']]')) {
              const rawInner = part.slice(2, -2)
              const [target, alias] = rawInner.split('|')
              const displayText = alias ? alias.trim() : target.trim()
              return (
                <button
                  key={pIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onNavigateDocument?.(target.trim())
                  }}
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 font-medium transition-colors cursor-pointer text-xs align-baseline mx-0.5"
                  title={`문서로 이동: ${target.trim()}`}
                >
                  <span className="opacity-60 text-[10px]">[[</span>
                  <span>{displayText}</span>
                  <span className="opacity-60 text-[10px]">]]</span>
                </button>
              )
            } else if (part.startsWith('==') && part.endsWith('==')) {
              const highlightText = part.slice(2, -2)
              return (
                <mark
                  key={pIdx}
                  className="bg-amber-200/70 dark:bg-amber-900/50 text-foreground px-1 py-0.5 rounded font-medium"
                >
                  {highlightText}
                </mark>
              )
            } else if (part.startsWith('[^') && part.endsWith(']')) {
              return (
                <sup
                  key={pIdx}
                  className="px-1 py-0.2 rounded font-mono text-[10px] bg-muted text-primary cursor-help font-semibold border border-border"
                >
                  {part}
                </sup>
              )
            }
            return <React.Fragment key={pIdx}>{part}</React.Fragment>
          })}
          {lineIdx < lines.length - 1 && '\n'}
        </React.Fragment>
      )
    })
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-foreground text-background text-xs font-semibold shadow-float animate-in fade-in slide-in-from-top-2 duration-150">
          {actionSuccessMsg}
        </div>
      )}

      {/* Floating Highlight / Note Popover */}
      {popoverPos && (
        <div
          style={{ top: `${popoverPos.y}px`, left: `${popoverPos.x}px` }}
          className="fixed -translate-x-1/2 z-50 flex flex-col items-center select-none"
        >
          <div className="flex items-center gap-1 p-1 bg-popover/95 backdrop-blur-md border border-border rounded-xl shadow-float text-xs animate-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={handleAddHighlight}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted font-medium transition-colors"
              title="텍스트에 ==형광펜== 하이라이트 적용"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              <span>하이라이트</span>
            </button>
            <span className="w-px h-3.5 bg-border" />
            <button
              type="button"
              onClick={() => setNoteInputOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted font-medium transition-colors"
              title="각주 형태의 메모 작성"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>메모</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPopoverPos(null)
                setNoteInputOpen(false)
              }}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Footnote Note Input Form */}
          {noteInputOpen && (
            <div className="mt-2 w-72 p-3 bg-card border border-border rounded-xl shadow-float flex flex-col gap-2 animate-in fade-in duration-100">
              <div className="text-[11px] font-semibold text-muted-foreground truncate">
                선택: &quot;{selectedText}&quot;
              </div>
              <textarea
                autoFocus
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="각주에 기록할 메모를 입력하세요..."
                className="w-full text-xs bg-muted/50 border border-border rounded-lg p-2 resize-none h-20 focus:outline-none focus:border-primary text-foreground"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setNoteInputOpen(false)}
                  className="px-2.5 py-1 rounded text-xs text-muted-foreground hover:bg-muted"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!noteContent.trim()}
                  className="px-3 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
      <div
        ref={contentAreaRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto p-6 space-y-4 select-text"
      >
        {/* Quality Score Card */}
        {item.quality_score !== undefined && item.quality_score !== null && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/80 shadow-subtle">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                  item.quality_score >= 85
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : item.quality_score >= 70
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                품질 점수: {item.quality_score}점
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {item.quality_score >= 85
                  ? '우수 — 본문과 서식이 완전하게 보존되었습니다'
                  : item.quality_score >= 70
                  ? '양호 — 본문이 잘 추출되었습니다'
                  : '검토 필요 — 이미지 누락 또는 서식 확인이 필요합니다'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted/80 font-mono">
                프로필: {item.profile || 'balanced'}
              </span>
            </div>
          </div>
        )}

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

        {/* Rendered Markdown Body with Wiki Link & Highlight interactive support */}
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap font-sans">
          {renderInteractiveMarkdown(bodyText) || (
            <span className="text-muted-foreground italic">내용이 비어 있습니다.</span>
          )}
        </div>
      </div>
    </div>
  )
}
