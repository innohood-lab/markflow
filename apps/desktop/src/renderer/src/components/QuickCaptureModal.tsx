import React, { useState, useEffect, useRef } from 'react'
import { Zap, X, Tag as TagIcon, Clipboard, Check } from 'lucide-react'

interface QuickCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newDoc: any) => void
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(['빠른캡처'])
  const [copiedPasted, setCopiedPasted] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setBody('')
      setTags(['빠른캡처'])
      setTagInput('')
      setCopiedPasted(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!body.trim() && !title.trim()) return
    if (window.markflowApi?.quickCaptureNote) {
      const res = await window.markflowApi.quickCaptureNote(title, body, tags)
      if (res && res.item) {
        onSuccess(res.item)
        onClose()
      }
    }
  }

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setBody((prev) => (prev ? `${prev}\n\n${text}` : text))
        setCopiedPasted(true)
        setTimeout(() => setCopiedPasted(false), 1500)
      }
    } catch (err) {
      console.warn('Failed to read clipboard:', err)
    }
  }

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '')
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-floating flex flex-col overflow-hidden animate-in zoom-in-95 duration-100"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between shrink-0 bg-sidebar-background/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">빠른 캡처 (Quick Capture)</h2>
              <p className="text-[10px] text-muted-foreground">생각이나 아이디어를 즉시 수집함(Inbox)에 마크다운으로 보관합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-3">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (비워둘 시 시간으로 자동 생성)..."
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="여기에 생각, 메모, 또는 텍스트를 입력하세요... (Ctrl+Enter 로 저장)"
              className="w-full h-32 px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs text-foreground focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground leading-relaxed"
            />

            {/* Paste Clipboard button */}
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded bg-card/80 hover:bg-card border border-border text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 shadow-subtle transition-colors"
              title="클립보드 내용 붙여넣기"
            >
              {copiedPasted ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 font-semibold">붙여넣음!</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-3 h-3" />
                  <span>클립보드 붙여넣기</span>
                </>
              )}
            </button>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
            <TagIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-medium"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="hover:text-rose-500 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="+ 태그 입력"
              className="w-20 px-2 py-0.5 rounded border border-border text-[10px] bg-muted/50 text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 bg-sidebar-background/40 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-muted-foreground">
            <span>단축키: </span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">Ctrl+Enter</kbd>
            <span> 저장</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!body.trim() && !title.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-subtle"
            >
              수집함에 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
