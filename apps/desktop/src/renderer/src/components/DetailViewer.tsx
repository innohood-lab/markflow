import React, { useState } from 'react'
import { ConversionRecord } from '../../../preload'
import {
  ArrowLeft,
  Eye,
  Columns,
  Edit3,
  RotateCw,
  FolderOpen,
  Copy,
  Check,
  Trash2,
  Calendar,
  HardDrive,
  Share2,
  Github,
  Folder,
  Zap,
  ChevronDown,
  Link as LinkIcon,
  Sparkles,
  AlertTriangle,
  Compass,
  X
} from 'lucide-react'
import { FrontmatterForm, FrontmatterData } from './FrontmatterForm'
import { CompareSplitView } from './CompareSplitView'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { ReconvertModal } from './ReconvertModal'
import { ExportDropdownMenu } from './ExportDropdownMenu'

interface DetailViewerProps {
  item: ConversionRecord
  onBack: () => void
  onUpdateItem: (updated: ConversionRecord) => void
  onDelete: (id: number) => void
  onExportSingle?: (itemId: number, target: string) => void
  onNavigateDocument?: (titleOrSlug: string) => void
}

export const DetailViewer: React.FC<DetailViewerProps> = ({
  item,
  onBack,
  onUpdateItem,
  onDelete,
  onExportSingle,
  onNavigateDocument
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'compare' | 'edit'>('preview')
  const [isReconvertOpen, setIsReconvertOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)

  // Backlinks state
  const [backlinks, setBacklinks] = useState<{ sourceSlug: string; sourceTitle: string; snippet: string }[]>([])
  const [backlinksOpen, setBacklinksOpen] = useState(true)

  // Phase 8-(다) AI Recommendations & Duplicate state
  const [aiRecs, setAiRecs] = useState<{
    suggestedGroup: string | null
    groupConfidence: number
    suggestedTags: string[]
    isDuplicate: boolean
    duplicateMatch: { slug: string; title: string; score: number } | null
    relatedDocuments: { slug: string; title: string; score: number; snippet: string; groups?: string[] }[]
  } | null>(null)
  const [relatedOpen, setRelatedOpen] = useState(true)
  const [dismissDuplicate, setDismissDuplicate] = useState(false)

  // Fetch backlinks for current document
  React.useEffect(() => {
    if (window.markflowApi?.getBacklinks && item.title) {
      window.markflowApi.getBacklinks(item.title, item.slug).then((res) => {
        setBacklinks(res || [])
      }).catch(() => {
        setBacklinks([])
      })
    }
  }, [item.title, item.slug])

  // Parse Frontmatter vs Body
  const parseFrontmatter = (mdText: string): { data: FrontmatterData; body: string } => {
    let title = item.title
    let status = item.status || 'inbox'
    let tags: string[] = []
    let groups: string[] = []
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

        const groupsMatch = fmStr.match(/groups:\s*\[([^\]]*)\]/)
        if (groupsMatch && groupsMatch[1].trim()) {
          groups = groupsMatch[1]
            .split(',')
            .map((g) => g.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
        }
      }
    }

    return {
      data: { title, status, tags, category, groups },
      body
    }
  }

  const { data: fmData, body: currentBody } = parseFrontmatter(item.markdown || '')

  // Fetch AI Recommendations & Duplicate check
  React.useEffect(() => {
    if (window.markflowApi?.getAiRecommendations && currentBody) {
      window.markflowApi.getAiRecommendations(currentBody, item.slug).then((res) => {
        setAiRecs(res)
      }).catch(() => {
        setAiRecs(null)
      })
    }
  }, [item.slug, currentBody])

  // Re-serialize Frontmatter + Body
  const serializeMarkdown = (newFmData: FrontmatterData, bodyContent: string): string => {
    const tagsFormatted = `[${newFmData.tags.map((t) => `"${t}"`).join(', ')}]`
    const groupsFormatted = `[${(newFmData.groups || []).map((g) => `"${g}"`).join(', ')}]`
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
groups: ${groupsFormatted}
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

  // Apply suggested group
  const handleApplySuggestedGroup = async () => {
    if (!aiRecs?.suggestedGroup) return
    const currentGroups = fmData.groups || []
    if (currentGroups.includes(aiRecs.suggestedGroup)) return

    const updatedGroups = [...currentGroups, aiRecs.suggestedGroup]
    await handleFrontmatterChange({ ...fmData, groups: updatedGroups })
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
      <div className="px-5 py-3 border-b border-border/60 bg-sidebar-background/40 flex items-center justify-between gap-4 shrink-0 select-none app-drag-region">
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
        <div className="flex items-center gap-1.5 shrink-0 relative">
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-subtle transition-all"
              title="폴더 선택 저장 · 클라우드 드라이브 · 지식 저장소로 내보내기"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>저장 · 내보내기</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            <ExportDropdownMenu
              isOpen={isExportMenuOpen}
              onClose={() => setIsExportMenuOpen(false)}
              onSelectTarget={(target) => onExportSingle?.(item.id, target)}
              align="right"
            />
          </div>

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

      {/* Duplicate Warning Banner */}
      {aiRecs?.isDuplicate && !dismissDuplicate && aiRecs.duplicateMatch && (
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">
              <strong>중복 감지:</strong> 기존 문서 &apos;{aiRecs.duplicateMatch.title}&apos;와 내용이{' '}
              <strong>{aiRecs.duplicateMatch.score}%</strong> 일치합니다.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateDocument?.(aiRecs.duplicateMatch!.slug)}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-xs transition-colors"
            >
              원본 비교
            </button>
            <button
              type="button"
              onClick={() => setDismissDuplicate(true)}
              className="p-1 hover:bg-amber-500/20 rounded transition-colors text-amber-700 dark:text-amber-300"
              title="닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Suggested Group (Auto Categorization) Banner */}
      {aiRecs?.suggestedGroup && !(fmData.groups || []).includes(aiRecs.suggestedGroup) && (
        <div className="px-5 py-2 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200 shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="truncate">
              <strong>AI 자동 분류 제안:</strong> 이 문서는{' '}
              <strong className="text-indigo-600 dark:text-indigo-400">[{aiRecs.suggestedGroup}]</strong> 그룹과{' '}
              {aiRecs.groupConfidence}% 유사합니다.
            </span>
          </div>
          <button
            type="button"
            onClick={handleApplySuggestedGroup}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-subtle shrink-0"
          >
            분류 적용
          </button>
        </div>
      )}

      {/* Frontmatter Properties Bar */}
      <FrontmatterForm
        data={fmData}
        onChange={handleFrontmatterChange}
        qualityScore={item.quality_score}
      />

      {/* Main Content Area by Tab */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <MarkdownPreview
              item={item}
              onDelete={onDelete}
              onNavigateDocument={onNavigateDocument}
              onDocumentUpdated={(newMd) => {
                onUpdateItem({ ...item, markdown: newMd })
              }}
            />

            {/* Backlinks Section (Obsidian / Things 3 style) */}
            <div className="border-t border-border/70 bg-sidebar-background/30 shrink-0">
              <button
                type="button"
                onClick={() => setBacklinksOpen(!backlinksOpen)}
                className="w-full px-5 py-2 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5 text-primary" />
                  <span>역링크 (Backlinks)</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono text-[10px]">
                    {backlinks.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    backlinksOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {backlinksOpen && (
                <div className="px-5 pb-3 max-h-36 overflow-y-auto space-y-1.5 animate-in fade-in duration-100">
                  {backlinks.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/70 py-1">
                      이 문서를 참조하는 다른 문서가 없습니다.
                    </div>
                  ) : (
                    backlinks.map((bl, idx) => (
                      <div
                        key={idx}
                        onClick={() => onNavigateDocument?.(bl.sourceTitle || bl.sourceSlug)}
                        className="p-2 rounded-lg bg-card/80 border border-border/60 hover:border-primary/40 hover:bg-muted/60 transition-all cursor-pointer group text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-foreground group-hover:text-primary transition-colors text-[11px]">
                          <span>{bl.sourceTitle}</span>
                          <span className="text-[10px] text-muted-foreground font-mono font-normal">
                            {bl.sourceSlug}.md
                          </span>
                        </div>
                        {bl.snippet && (
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5 line-clamp-2">
                            {bl.snippet}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Related Documents Section (AI Recommendations / See Also) */}
            {aiRecs && aiRecs.relatedDocuments.length > 0 && (
              <div className="border-t border-border/70 bg-sidebar-background/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setRelatedOpen(!relatedOpen)}
                  className="w-full px-5 py-2 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-indigo-500" />
                    <span>관련 문서 (AI 추천)</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px]">
                      {aiRecs.relatedDocuments.length}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      relatedOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {relatedOpen && (
                  <div className="px-5 pb-3 max-h-36 overflow-y-auto space-y-1.5 animate-in fade-in duration-100">
                    {aiRecs.relatedDocuments.map((rel, idx) => (
                      <div
                        key={idx}
                        onClick={() => onNavigateDocument?.(rel.slug)}
                        className="p-2 rounded-lg bg-card/80 border border-border/60 hover:border-indigo-500/40 hover:bg-muted/60 transition-all cursor-pointer group text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-[11px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <span>{rel.title}</span>
                            {rel.groups && rel.groups.length > 0 && (
                              <span className="px-1 py-0.2 rounded bg-muted text-[10px] text-muted-foreground font-normal">
                                {rel.groups[0]}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono ml-2 shrink-0">
                            {rel.score}% 유사
                          </span>
                        </div>
                        {rel.snippet && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 font-mono">
                            {rel.snippet}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
