import React, { useState } from 'react'
import { ConversionRecord } from '../../../preload'
import { ArrowLeft, Eye, Columns, Edit3, RotateCw, FolderOpen, Copy, Check, Trash2, Calendar, HardDrive } from 'lucide-react'
import { FrontmatterForm, FrontmatterData } from './FrontmatterForm'
import { CompareSplitView } from './CompareSplitView'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { ReconvertModal } from './ReconvertModal'

interface DetailViewerProps {
  item: ConversionRecord
  onBack: () => void
  onUpdateItem: (updated: ConversionRecord) => void
  onDelete: (id: number) => void
}

export const DetailViewer: React.FC<DetailViewerProps> = ({
  item,
  onBack,
  onUpdateItem,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'compare' | 'edit'>('preview')
  const [isReconvertOpen, setIsReconvertOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Parse Frontmatter vs Body
  const parseFrontmatter = (mdText: string): { data: FrontmatterData; body: string } => {
    let title = item.title
    let status = item.status || 'inbox'
    let tags: string[] = []
    let category = ''
    let body = mdText

    if (mdText.startsWith('---')) {
      const parts = mdText.split('---')
      if (parts.length >= 3) {
        const fmStr = parts[1]
        body = parts.slice(2).join('---').trim()

        const titleMatch = fmStr.match(/title:\s*"([^"]+)"/)
        if (titleMatch) title = titleMatch[1]

        const statusMatch = fmStr.match(/status:\s*"([^"]+)"/)
        if (statusMatch) status = statusMatch[1]

        const categoryMatch = fmStr.match(/category:\s*"([^"]*)"/)
        if (categoryMatch) category = categoryMatch[1]

        const tagsMatch = fmStr.match(/tags:\s*\[([^\]]*)\]/)
        if (tagsMatch && tagsMatch[1].trim()) {
          tags = tagsMatch[1]
            .split(',')
            .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
        }
      }
    }

    return {
      data: { title, status, tags, category },
      body
    }
  }

  const { data: fmData, body: currentBody } = parseFrontmatter(item.markdown || '')

  // Re-serialize Frontmatter + Body
  const serializeMarkdown = (newFmData: FrontmatterData, bodyContent: string): string => {
    const tagsFormatted = `[${newFmData.tags.map((t) => `"${t}"`).join(', ')}]`
    const qsLine = item.quality_score !== undefined && item.quality_score !== null ? `quality_score: ${item.quality_score}` : 'quality_score: null'
    const profLine = `profile: "${item.profile || 'balanced'}"`

    return `---
title: "${newFmData.title}"
source_file: "${item.source_file}"
source_type: "${item.source_type}"
converted_at: "${item.converted_at}"
engine: "markitdown 0.1.8"
${profLine}
${qsLine}
status: "${newFmData.status}"
tags: ${tagsFormatted}
groups: []
category: "${newFmData.category}"
source_location: ""
exported:
  github: false
  obsidian: false
  gdrive: false
  onedrive: false
  dropbox: false
  icloud: false
---

${bodyContent}`
  }

  // Handle Frontmatter property changes (Notion style)
  const handleFrontmatterChange = async (newFmData: FrontmatterData) => {
    const fullMd = serializeMarkdown(newFmData, currentBody)
    if (window.markflowApi) {
      const res = await window.markflowApi.saveMarkdown(
        item.id,
        item.library_path,
        fullMd,
        newFmData.title,
        newFmData.status
      )
      if (res.success && res.item) {
        onUpdateItem(res.item)
      }
    }
  }

  // Handle Editor Body changes
  const handleEditorSave = async (newBody: string): Promise<boolean> => {
    const fullMd = serializeMarkdown(fmData, newBody)
    if (window.markflowApi) {
      const res = await window.markflowApi.saveMarkdown(
        item.id,
        item.library_path,
        fullMd,
        fmData.title,
        fmData.status
      )
      if (res.success && res.item) {
        onUpdateItem(res.item)
        return true
      }
    }
    return false
  }

  // Handle Reconvert execution
  const handleReconvertConfirm = async (selectedProfile: 'balanced' | 'fast' | 'best_quality') => {
    if (window.markflowApi && item.source_path) {
      const res = await window.markflowApi.backupAndReconvert(
        item.id,
        item.source_path,
        item.library_path,
        item.slug,
        selectedProfile
      )
      if (res.success && res.item) {
        onUpdateItem(res.item)
      }
    }
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Top Navigation & Action Bar */}
      <div className="px-5 py-3 border-b border-border/60 bg-sidebar-background/40 flex items-center justify-between gap-4 shrink-0 select-none">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-card border border-border/60 transition-colors shadow-subtle"
            title="수집함 목록으로 돌아가기"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>수집함</span>
          </button>

          <span className="w-px h-4 bg-border/80" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shrink-0">
              {item.source_type}
            </span>
            <span className="text-sm font-bold text-foreground truncate max-w-xs md:max-w-md">
              {item.title}
            </span>
          </div>
        </div>

        {/* Center: 3 Tab Switcher (Things style pills) */}
        <div className="flex items-center bg-card p-1 rounded-lg border border-border/80 shadow-subtle text-xs font-semibold">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
              activeTab === 'preview'
                ? 'bg-primary text-primary-foreground shadow-subtle'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>미리보기</span>
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
              activeTab === 'compare'
                ? 'bg-primary text-primary-foreground shadow-subtle'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>원본 비교</span>
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
              activeTab === 'edit'
                ? 'bg-primary text-primary-foreground shadow-subtle'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>편집</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsReconvertOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-foreground bg-card hover:bg-muted border border-border shadow-subtle transition-colors"
            title="프로필 선택 후 다시 변환 (기존 버전 백업)"
          >
            <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
            <span>재변환</span>
          </button>

          <button
            onClick={handleShowInFolder}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-foreground bg-card hover:bg-muted border border-border shadow-subtle transition-colors"
            title="탐색기에서 열기"
          >
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span>탐색기</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-foreground bg-card hover:bg-muted border border-border shadow-subtle transition-colors"
            title="Markdown 복사"
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
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frontmatter Properties Bar */}
      <FrontmatterForm
        data={fmData}
        onChange={handleFrontmatterChange}
        qualityScore={item.quality_score}
      />

      {/* Main Content Area by Tab */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'preview' && (
          <MarkdownPreview item={item} onDelete={onDelete} />
        )}
        {activeTab === 'compare' && (
          <CompareSplitView item={item} />
        )}
        {activeTab === 'edit' && (
          <MarkdownEditor
            initialContent={currentBody}
            onSave={handleEditorSave}
          />
        )}
      </div>

      {/* Reconvert Modal */}
      <ReconvertModal
        isOpen={isReconvertOpen}
        onClose={() => setIsReconvertOpen(false)}
        onConfirm={handleReconvertConfirm}
        fileName={item.title}
      />
    </div>
  )
}
