import React, { useState } from 'react'
import { ConversionRecord } from '../../../../preload'
import {
  ChevronDown,
  ArrowUpDown,
  Copy,
  Archive,
  Trash2,
  ExternalLink,
  Plus
} from 'lucide-react'

interface BoardTableViewProps {
  documents: ConversionRecord[]
  selectedSlugs: Set<string>
  onToggleSelect: (slug: string) => void
  onOpenDetail: (doc: ConversionRecord) => void
  onUpdateFrontmatter: (slug: string, updates: Record<string, any>) => void
  onDuplicate: (slug: string) => void
  onArchive: (slug: string, isArchived: boolean) => void
  onDelete: (id: number) => void
}

const STATUS_OPTIONS = [
  { value: 'inbox', label: '수집함', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { value: 'review_needed', label: '검토 필요', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { value: 'ready', label: '준비 완료', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { value: 'exported', label: '내보냄', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
  { value: 'archived', label: '보관됨', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' }
]

export const BoardTableView: React.FC<BoardTableViewProps> = ({
  documents,
  selectedSlugs,
  onToggleSelect,
  onOpenDetail,
  onUpdateFrontmatter,
  onDuplicate,
  onArchive,
  onDelete
}) => {
  const [editingCategorySlug, setEditingCategorySlug] = useState<string | null>(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [openStatusDropdownSlug, setOpenStatusDropdownSlug] = useState<string | null>(null)

  const handleStatusChange = (slug: string, newStatus: string) => {
    onUpdateFrontmatter(slug, { status: newStatus })
    setOpenStatusDropdownSlug(null)
  }

  const handleSaveCategory = (slug: string) => {
    onUpdateFrontmatter(slug, { category: categoryDraft.trim() })
    setEditingCategorySlug(null)
  }

  return (
    <div className="flex-1 overflow-auto border-t border-border/40 select-none">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-muted/40 sticky top-0 z-10 border-b border-border/60">
          <tr>
            <th className="py-2.5 px-3 w-10 text-center">
              <span className="sr-only">선택</span>
            </th>
            <th className="py-2.5 px-4 font-semibold text-muted-foreground w-1/3">
              문서 제목
            </th>
            <th className="py-2.5 px-3 font-semibold text-muted-foreground w-28">
              상태
            </th>
            <th className="py-2.5 px-3 font-semibold text-muted-foreground w-28">
              카테고리
            </th>
            <th className="py-2.5 px-3 font-semibold text-muted-foreground w-44">
              태그
            </th>
            <th className="py-2.5 px-3 font-semibold text-muted-foreground w-24">
              품질 점수
            </th>
            <th className="py-2.5 px-3 font-semibold text-muted-foreground w-24">
              형식
            </th>
            <th className="py-2.5 px-3 font-semibold text-muted-foreground w-28">
              생성 일자
            </th>
            <th className="py-2.5 px-3 w-20 text-center font-semibold text-muted-foreground">
              관리
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {documents.map((doc) => {
            const isSelected = selectedSlugs.has(doc.slug)
            const currentStatusOpt =
              STATUS_OPTIONS.find((s) => s.value === doc.status) || STATUS_OPTIONS[0]

            return (
              <tr
                key={doc.slug}
                className={`hover:bg-muted/30 transition-colors ${
                  isSelected ? 'bg-primary/5' : ''
                }`}
              >
                {/* Select Checkbox */}
                <td className="py-2 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(doc.slug)}
                    className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-0 cursor-pointer"
                  />
                </td>

                {/* Title */}
                <td className="py-2 px-4 font-medium text-foreground">
                  <div className="flex items-center justify-between group">
                    <span
                      onClick={() => onOpenDetail(doc)}
                      className="cursor-pointer hover:text-primary hover:underline truncate max-w-[260px]"
                      title={doc.title || doc.slug}
                    >
                      {doc.title || doc.slug}
                    </span>
                    <button
                      onClick={() => onOpenDetail(doc)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-opacity"
                      title="상세 보기"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </td>

                {/* Status (Inline Dropdown) */}
                <td className="py-2 px-3 relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenStatusDropdownSlug(
                        openStatusDropdownSlug === doc.slug ? null : doc.slug
                      )
                    }
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center justify-between gap-1.5 w-full ${currentStatusOpt.color}`}
                  >
                    <span>{currentStatusOpt.label}</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </button>

                  {openStatusDropdownSlug === doc.slug && (
                    <div className="absolute left-3 top-9 z-20 bg-card border border-border shadow-floating rounded-lg py-1 w-32 animate-fade-in">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleStatusChange(doc.slug, opt.value)}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              opt.value === 'ready' || opt.value === 'exported'
                                ? 'bg-emerald-500'
                                : opt.value === 'review_needed'
                                  ? 'bg-amber-500'
                                  : opt.value === 'archived'
                                    ? 'bg-gray-400'
                                    : 'bg-blue-500'
                            }`}
                          />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </td>

                {/* Category (Inline Edit) */}
                <td className="py-2 px-3">
                  {editingCategorySlug === doc.slug ? (
                    <input
                      type="text"
                      autoFocus
                      value={categoryDraft}
                      onChange={(e) => setCategoryDraft(e.target.value)}
                      onBlur={() => handleSaveCategory(doc.slug)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveCategory(doc.slug)
                        if (e.key === 'Escape') setEditingCategorySlug(null)
                      }}
                      className="w-full px-2 py-0.5 rounded bg-background border border-primary text-xs focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingCategorySlug(doc.slug)
                        setCategoryDraft(doc.category || '')
                      }}
                      className="cursor-pointer hover:bg-muted px-2 py-0.5 rounded text-muted-foreground hover:text-foreground block truncate"
                      title="클릭하여 카테고리 편집"
                    >
                      {doc.category || <span className="opacity-40">+ 입력</span>}
                    </span>
                  )}
                </td>

                {/* Tags */}
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-1 items-center max-w-[200px]">
                    {doc.tags && doc.tags.length > 0 ? (
                      doc.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground text-[10px]"
                        >
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground/40 text-[11px]">-</span>
                    )}
                  </div>
                </td>

                {/* Quality Score */}
                <td className="py-2 px-3">
                  {doc.quality_score !== null && doc.quality_score !== undefined ? (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        doc.quality_score >= 85
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : doc.quality_score >= 70
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {doc.quality_score}점
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>

                {/* Source Type */}
                <td className="py-2 px-3 uppercase text-muted-foreground font-mono text-[11px]">
                  {doc.source_type}
                </td>

                {/* Converted At */}
                <td className="py-2 px-3 text-muted-foreground text-[11px]">
                  {doc.converted_at ? doc.converted_at.split('T')[0] : ''}
                </td>

                {/* Actions */}
                <td className="py-2 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onDuplicate(doc.slug)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="문서 복제"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onArchive(doc.slug, doc.status !== 'archived')}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                      title={doc.status === 'archived' ? '보관 해제' : '보관'}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    {doc.id && (
                      <button
                        onClick={() => onDelete(doc.id!)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
