import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileSliders,
  FileCode,
  FileImage,
  FileArchive,
  File,
  RotateCw,
  X,
  Play,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react'

export interface QueueItem {
  id: string
  path: string
  name: string
  size: number
  status: 'pending' | 'converting' | 'done' | 'failed' | 'unsupported'
  errorMessage?: string
}

interface QueueSectionProps {
  queue: QueueItem[]
  onAddFiles: (files: { path: string; name: string; size: number }[]) => void
  onRemoveItem: (id: string) => void
  onClearQueue: () => void
  onConvertAll: () => void
  onRetryItem: (id: string) => void
  autoConvert: boolean
  onToggleAutoConvert: (enabled: boolean) => void
  isConverting: boolean
  profile: 'balanced' | 'fast' | 'best_quality'
  onProfileChange: (profile: 'balanced' | 'fast' | 'best_quality') => void
}

export const QueueSection: React.FC<QueueSectionProps> = ({
  queue,
  onAddFiles,
  onRemoveItem,
  onClearQueue,
  onConvertAll,
  onRetryItem,
  autoConvert,
  onToggleAutoConvert,
  isConverting,
  profile,
  onProfileChange
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const fileList = files.map((f) => ({
      path: (f as any).path || f.name,
      name: f.name,
      size: f.size
    }))

    onAddFiles(fileList)
  }

  const handleOpenFileDialog = async () => {
    if (window.markflowApi) {
      const selected = await window.markflowApi.selectFilesOrFolders()
      if (selected.length > 0) {
        onAddFiles(selected)
      }
    }
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    switch (ext) {
      case 'docx':
      case 'doc':
      case 'txt':
        return <FileText className="w-4 h-4 text-blue-500 shrink-0" />
      case 'pptx':
      case 'ppt':
        return <FileSliders className="w-4 h-4 text-orange-500 shrink-0" />
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-500 shrink-0" />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return <FileImage className="w-4 h-4 text-purple-500 shrink-0" />
      case 'html':
      case 'json':
      case 'xml':
        return <FileCode className="w-4 h-4 text-cyan-500 shrink-0" />
      case 'zip':
        return <FileArchive className="w-4 h-4 text-amber-500 shrink-0" />
      default:
        return <File className="w-4 h-4 text-muted-foreground shrink-0" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const pendingCount = queue.filter((i) => i.status === 'pending').length
  const convertingCount = queue.filter((i) => i.status === 'converting').length

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background border-r border-border/40 select-none">
      {/* Section Header */}
      <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between shrink-0 bg-sidebar-background/30">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">변환 대기열</h2>
          {queue.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
              {queue.length}
            </span>
          )}
        </div>

        {/* Profile Selector */}
        <div className="flex items-center gap-2">
          <select
            value={profile}
            onChange={(e) => onProfileChange(e.target.value as any)}
            className="text-[11px] bg-card hover:bg-muted border border-border/70 rounded-md px-2 py-1 text-foreground font-medium outline-none cursor-pointer transition-colors shadow-subtle"
            title="변환 품질 프로필 선택"
          >
            <option value="balanced">균형 모드</option>
            <option value="fast">빠름 모드</option>
            <option value="best_quality">최고 품질 (OCR)</option>
          </select>
        </div>
      </div>

      {/* Big Drag and Drop Target Area */}
      <div className="p-4 shrink-0">
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleOpenFileDialog}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-fast ${
            isDragOver
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : 'border-border/80 hover:border-primary/50 hover:bg-muted/40 bg-card'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-subtle">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-foreground">
            파일 또는 폴더를 여기에 놓으세요
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            내 PC 파일 드래그 · 클릭하여 탐색기에서 선택 (폴더 포함)
          </p>
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-1.5">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs">
            <p>대기열에 추가된 문서가 없습니다</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              지원 형식: Office, PDF, 이미지, HTML, CSV 등
            </p>
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/70 hover:border-border shadow-subtle transition-colors duration-fast text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                {getFileIcon(item.name)}
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatFileSize(item.size)}
                  </p>
                </div>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {item.status === 'converting' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    변환중
                  </span>
                )}
                {item.status === 'pending' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                    대기
                  </span>
                )}
                {item.status === 'done' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    완료
                  </span>
                )}
                {item.status === 'failed' && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 cursor-help"
                    title={item.errorMessage || '변환 실패'}
                  >
                    <AlertCircle className="w-3 h-3" />
                    실패
                  </span>
                )}
                {item.status === 'unsupported' && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 cursor-help"
                    title={item.errorMessage || '미지원 파일 형식'}
                  >
                    <HelpCircle className="w-3 h-3" />
                    미지원
                  </span>
                )}

                {/* Retry action if failed */}
                {(item.status === 'failed' || item.status === 'unsupported') && (
                  <button
                    onClick={() => onRetryItem(item.id)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="재시도"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Remove from queue */}
                <button
                  onClick={() => onRemoveItem(item.id)}
                  disabled={item.status === 'converting'}
                  className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 transition-colors"
                  title="대기열에서 제거"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="p-4 border-t border-border/50 bg-sidebar-background/60 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoConvert}
              onChange={(e) => onToggleAutoConvert(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
            />
            <span>넣자마자 자동 변환</span>
          </label>
          <span className="text-[11px] text-muted-foreground font-medium">
            동시 최대 2개 변환
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onConvertAll}
            disabled={pendingCount === 0 || isConverting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-40 text-primary-foreground text-xs font-semibold shadow-subtle transition-all duration-fast active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>전체 변환 ({pendingCount}건)</span>
          </button>

          <button
            onClick={onClearQueue}
            disabled={queue.length === 0}
            className="py-2 px-3 rounded-lg bg-card hover:bg-muted disabled:opacity-40 text-muted-foreground hover:text-foreground text-xs font-medium border border-border shadow-subtle transition-colors"
            title="대기열 비우기"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
