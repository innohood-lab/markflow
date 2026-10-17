import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Table as TableIcon,
  Search,
  Save,
  Check,
  RotateCw,
  X
} from 'lucide-react'

interface MarkdownEditorProps {
  initialContent: string
  onSave: (content: string) => Promise<boolean>
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ initialContent, onSave }) => {
  const [content, setContent] = useState(initialContent)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchMatches, setSearchMatches] = useState<number>(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Update content if initialContent changes externally (e.g. reconvert)
  useEffect(() => {
    setContent(initialContent)
    setSaveStatus('saved')
  }, [initialContent])

  // Debounced auto-save (2 seconds)
  const triggerAutoSave = useCallback(
    (textToSave: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      setSaveStatus('dirty')

      debounceTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        const success = await onSave(textToSave)
        setSaveStatus(success ? 'saved' : 'dirty')
      }, 2000)
    },
    [onSave]
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setContent(newText)
    triggerAutoSave(newText)
  }

  // Immediate manual save (Ctrl+S / Cmd+S)
  const handleManualSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setSaveStatus('saving')
    const success = await onSave(content)
    setSaveStatus(success ? 'saved' : 'dirty')
  }, [content, onSave])

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleManualSave()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  // Insert markdown helpers
  const insertText = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.substring(start, end)
    const replacement = `${prefix}${selected}${suffix}`

    const newContent = content.substring(0, start) + replacement + content.substring(end)
    setContent(newContent)
    triggerAutoSave(newContent)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, end + prefix.length)
    }, 10)
  }

  // Search occurrence calculation
  useEffect(() => {
    if (!searchKeyword.trim()) {
      setSearchMatches(0)
      return
    }
    const regex = new RegExp(searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches = content.match(regex)
    setSearchMatches(matches ? matches.length : 0)
  }, [searchKeyword, content])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Editor Toolbar */}
      <div className="px-4 py-2 border-b border-border/60 bg-sidebar-background/30 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => insertText('# ')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="제목 1 (#)"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('## ')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="제목 2 (##)"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('### ')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="제목 3 (###)"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-border/80 mx-1" />

          <button
            type="button"
            onClick={() => insertText('**', '**')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="굵게 (**텍스트**)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('*', '*')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="기울임 (*텍스트*)"
          >
            <Italic className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-border/80 mx-1" />

          <button
            type="button"
            onClick={() => insertText('- ')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="글머리 기호 목록 (- )"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('1. ')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="번호 매기기 목록 (1. )"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('> ')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="인용구 (> )"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('```\n', '\n```')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="코드 블록 (```)"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('| 항목 | 내용 |\n| --- | --- |\n| ', ' | 값 |')}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="표 (Table)"
          >
            <TableIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Right Status & Manual Save */}
        <div className="flex items-center gap-3 text-xs">
          {/* Save Status Indicator */}
          <div className="flex items-center gap-1.5">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-primary">
                <RotateCw className="w-3 h-3 animate-spin" />
                <span>저장 중...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3 h-3" />
                <span>저장됨</span>
              </span>
            )}
            {saveStatus === 'dirty' && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                수정됨 (2초 후 자동저장)
              </span>
            )}
          </div>

          <button
            onClick={handleManualSave}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-card hover:bg-muted border border-border shadow-subtle text-foreground text-xs font-medium transition-colors"
            title="즉시 저장 (Ctrl+S / Cmd+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>저장</span>
          </button>
        </div>
      </div>

      {/* In-document Search Bar (Ctrl+F) */}
      {searchOpen && (
        <div className="px-4 py-2 bg-muted/60 border-b border-border flex items-center justify-between gap-3 text-xs shrink-0 select-none">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="문서 내 검색..."
              className="flex-1 bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
            />
            {searchKeyword && (
              <span className="text-[11px] text-muted-foreground">
                {searchMatches}건 일치
              </span>
            )}
          </div>
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder="여기에 마크다운 내용을 입력하거나 수정하세요..."
          className="flex-1 w-full h-full resize-none font-mono text-sm leading-relaxed bg-transparent border-0 focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground/60 select-text"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
