import React, { useState, useEffect } from 'react'
import { ConversionRecord } from '../../../preload'
import { ExternalLink, FileText, FileSpreadsheet, FileSliders, Eye, HardDrive, AlertCircle } from 'lucide-react'

interface CompareSplitViewProps {
  item: ConversionRecord
}

export const CompareSplitView: React.FC<CompareSplitViewProps> = ({ item }) => {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const ext = (item.source_type || '').toLowerCase()
  const isPdf = ext === 'pdf'
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
  const isHtml = ['html', 'htm'].includes(ext)
  const isOffice = ['docx', 'pptx', 'xlsx', 'xls', 'csv'].includes(ext)

  useEffect(() => {
    let active = true
    setIsLoading(true)

    if (item.source_path && window.markflowApi && (isPdf || isImage || isHtml)) {
      window.markflowApi.getOriginalFileUrl(item.source_path).then((url) => {
        if (active) {
          setOriginalUrl(url)
          setIsLoading(false)
        }
      })
    } else {
      setIsLoading(false)
    }

    return () => {
      active = false
    }
  }, [item.source_path, ext])

  const handleOpenInSystemApp = () => {
    if (item.source_path && window.markflowApi) {
      window.markflowApi.openPath(item.source_path)
    }
  }

  // Strip frontmatter from markdown body for side-by-side view
  let bodyText = item.markdown || ''
  if (bodyText.startsWith('---')) {
    const parts = bodyText.split('---')
    if (parts.length >= 3) {
      bodyText = parts.slice(2).join('---').trim()
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden divide-x divide-border/60">
      {/* Left Pane: Original File Viewer */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-sidebar-background/20">
        <div className="px-4 py-2 border-b border-border/40 bg-card flex items-center justify-between shrink-0 select-none">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" />
            원본 문서 ({item.source_file})
          </span>
          {item.source_path && (
            <button
              onClick={handleOpenInSystemApp}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              title="OS 기본 앱에서 원본 열기"
            >
              <ExternalLink className="w-3 h-3" />
              <span>기본 앱으로 열기</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {isLoading ? (
            <div className="text-xs text-muted-foreground animate-pulse">원본 문서를 불러오는 중...</div>
          ) : isPdf && originalUrl ? (
            <iframe
              src={originalUrl}
              className="w-full h-full border border-border/60 rounded-lg shadow-subtle bg-card"
              title="PDF Original"
            />
          ) : isImage && originalUrl ? (
            <div className="w-full h-full flex items-center justify-center p-2">
              <img
                src={originalUrl}
                alt="원본 이미지"
                className="max-h-full max-w-full object-contain rounded-lg border border-border/60 shadow-subtle"
              />
            </div>
          ) : isHtml && originalUrl ? (
            <iframe
              sandbox="allow-same-origin"
              srcDoc={originalUrl}
              className="w-full h-full border border-border/60 rounded-lg shadow-subtle bg-white text-black"
              title="HTML Original"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-card border border-border/80 flex items-center justify-center shadow-subtle">
                {ext === 'docx' && <FileText className="w-6 h-6 text-blue-500" />}
                {ext === 'pptx' && <FileSliders className="w-6 h-6 text-orange-500" />}
                {(ext === 'xlsx' || ext === 'csv') && <FileSpreadsheet className="w-6 h-6 text-emerald-500" />}
                {!['docx', 'pptx', 'xlsx', 'csv'].includes(ext) && <HardDrive className="w-6 h-6 text-muted-foreground" />}
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground">{item.source_file}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  이 포맷({ext.toUpperCase()})은 Office 또는 전용 앱에서 가장 정확하게 열람할 수 있습니다.
                </p>
              </div>

              <button
                onClick={handleOpenInSystemApp}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-subtle transition-all duration-fast"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>OS 기본 연결 프로그램으로 열기</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Converted Markdown Output */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <div className="px-4 py-2 border-b border-border/40 bg-card flex items-center justify-between shrink-0 select-none">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            변환 결과 마크다운 (Markdown)
          </span>
          <span className="text-[11px] text-muted-foreground">
            {item.slug}.md
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 select-text">
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap font-sans">
            {bodyText || <span className="text-muted-foreground italic">본문 내용이 없습니다.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
