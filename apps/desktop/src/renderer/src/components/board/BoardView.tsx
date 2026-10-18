import React, { useState, useEffect, useCallback } from 'react'
import { ConversionRecord } from '../../../../preload'
import { BoardListView } from './BoardListView'
import { BoardTableView } from './BoardTableView'
import { BoardKanbanView } from './BoardKanbanView'
import { BoardGalleryView } from './BoardGalleryView'
import { NewDocumentModal } from './NewDocumentModal'
import { ExportDropdownMenu } from '../ExportDropdownMenu'
import {
  List,
  Table as TableIcon,
  Columns,
  LayoutGrid,
  Search,
  Plus,
  RefreshCw,
  Filter,
  Check,
  Tag,
  Archive,
  Trash2,
  Share2,
  FolderOpen,
  Cloud,
  ChevronUp,
  X
} from 'lucide-react'

export type BoardViewMode = 'list' | 'table' | 'kanban' | 'gallery'

interface BoardViewProps {
  onOpenDetail: (doc: ConversionRecord) => void
  onExport: (target: string, itemIds: number[]) => void
  groupFilter?: string
  initialSearchQuery?: string
  titleOverride?: string
}

export const BoardView: React.FC<BoardViewProps> = ({
  onOpenDetail,
  onExport,
  groupFilter,
  initialSearchQuery,
  titleOverride
}) => {
  const [viewMode, setViewMode] = useState<BoardViewMode>('list')
  const [documents, setDocuments] = useState<ConversionRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [sortOrder, setSortOrder] = useState<'latest' | 'name' | 'score'>('latest')

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery)
    }
  }, [initialSearchQuery])

  // Selection state for batch actions
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())
  const [moreExportOpen, setMoreExportOpen] = useState(false)

  // Modal states
  const [isNewDocOpen, setIsNewDocOpen] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null)

  // Fetch documents from SQLite FTS5 index
  const loadDocuments = useCallback(async () => {
    if (!window.markflowApi) return
    setIsLoading(true)
    try {
      const docs = await window.markflowApi.getBoardDocuments({
        search: searchQuery,
        sort: sortOrder,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        group: groupFilter || undefined,
        includeArchived
      })
      setDocuments(Array.isArray(docs) ? docs : (docs as any)?.items || [])
    } catch (err) {
      console.error('[BoardView] Failed to load documents:', err)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, sortOrder, statusFilter, categoryFilter, groupFilter, includeArchived])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Listen to external library changes (LibraryWatcher)
  useEffect(() => {
    if (window.markflowApi?.onLibraryChanged) {
      const unsubscribe = window.markflowApi.onLibraryChanged((event) => {
        console.log('[BoardView] External library file event:', event)
        loadDocuments()
      })
      return () => unsubscribe()
    }
  }, [loadDocuments])

  // Frontmatter update handler
  const handleUpdateFrontmatter = async (slug: string, updates: Record<string, any>) => {
    // Optimistic UI update
    setDocuments((prev) =>
      prev.map((d) => (d.slug === slug ? { ...d, ...updates } : d))
    )

    try {
      await window.markflowApi.updateFrontmatter(slug, updates)
      await loadDocuments()
    } catch (err) {
      console.error('[BoardView] Failed to update frontmatter:', err)
      await loadDocuments()
    }
  }

  // Create new document
  const handleCreateDocument = async (params: { title: string; category: string; tags: string[] }) => {
    try {
      const created = await window.markflowApi.createDocument(params)
      await loadDocuments()
      if (created) {
        onOpenDetail(created)
      }
    } catch (err) {
      console.error('[BoardView] Failed to create document:', err)
    }
  }

  // Duplicate document
  const handleDuplicate = async (slug: string) => {
    try {
      const copy = await window.markflowApi.duplicateDocument(slug)
      await loadDocuments()
      if (copy) {
        onOpenDetail(copy)
      }
    } catch (err) {
      console.error('[BoardView] Failed to duplicate document:', err)
    }
  }

  // Archive document
  const handleArchive = async (slug: string, isArchived: boolean) => {
    try {
      await window.markflowApi.archiveDocument(slug, isArchived)
      await loadDocuments()
    } catch (err) {
      console.error('[BoardView] Failed to archive document:', err)
    }
  }

  // Delete document
  const handleDelete = async (id: number) => {
    try {
      await window.markflowApi.deleteHistoryItem(id)
      await loadDocuments()
    } catch (err) {
      console.error('[BoardView] Failed to delete document:', err)
    }
  }

  // Rebuild index
  const handleRebuildIndex = async () => {
    setIsRebuilding(true)
    setRebuildMessage('Library 폴더 스캔 및 FTS5 색인 재구축 중...')
    try {
      const res = await window.markflowApi.rebuildIndex()
      setRebuildMessage(`${res.indexedCount}개 문서 색인 재구축 완료!`)
      await loadDocuments()
      setTimeout(() => setRebuildMessage(null), 3000)
    } catch (err: any) {
      setRebuildMessage(`색인 재구축 실패: ${err.message}`)
      setTimeout(() => setRebuildMessage(null), 4000)
    } finally {
      setIsRebuilding(false)
    }
  }

  // Selection toggle
  const handleToggleSelect = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  // Batch actions
  const handleBatchStatus = async (status: string) => {
    const slugs = Array.from(selectedSlugs)
    await window.markflowApi.batchUpdateDocuments(slugs, { status })
    setSelectedSlugs(new Set())
    await loadDocuments()
  }

  const handleBatchDelete = async () => {
    const slugs = Array.from(selectedSlugs)
    await window.markflowApi.batchUpdateDocuments(slugs, { delete: true })
    setSelectedSlugs(new Set())
    await loadDocuments()
  }

  const handleBatchExport = (target: string) => {
    const selectedDocs = documents.filter((d) => selectedSlugs.has(d.slug) && d.id)
    const itemIds = selectedDocs.map((d) => d.id!)
    if (itemIds.length > 0) {
      onExport(target, itemIds)
      setSelectedSlugs(new Set())
    }
  }

  // Distinct categories from loaded documents
  const allCategories = Array.from(
    new Set(documents.map((d) => d.category).filter(Boolean))
  ) as string[]

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background relative select-none">
      {/* 1. Board Header: Search, View Mode Toggle & Actions */}
      <header className="px-6 py-3.5 border-b border-border/40 shrink-0 flex flex-col gap-3 app-drag-region">
        {/* Top row: Title + Rebuild Message + View Mode Segmented Button + New Doc Button */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{titleOverride || (groupFilter ? `프로젝트: ${groupFilter}` : '라이브러리 보드')}</span>
              {rebuildMessage && (
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-primary/10 text-primary animate-fade-in">
                  {rebuildMessage}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              마크다운 파일 기반 노션형 데이터베이스 · 총 <strong className="text-foreground">{documents.length}</strong>개 문서
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* 4-View Segmented Toggle */}
            <div className="bg-muted p-0.5 rounded-lg flex items-center border border-border/40">
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-card text-foreground shadow-subtle'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="목록 보기"
              >
                <List className="w-3.5 h-3.5" />
                <span>목록</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-card text-foreground shadow-subtle'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="표 보기"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>표</span>
              </button>

              <button
                onClick={() => setViewMode('kanban')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-card text-foreground shadow-subtle'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="칸반 보기"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>칸반</span>
              </button>

              <button
                onClick={() => setViewMode('gallery')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'gallery'
                    ? 'bg-card text-foreground shadow-subtle'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="갤러리 보기"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>갤러리</span>
              </button>
            </div>

            {/* Rebuild Index Button */}
            <button
              onClick={handleRebuildIndex}
              disabled={isRebuilding}
              className="p-1.5 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Library 폴더 스캔 및 색인 다시 만들기"
            >
              <RefreshCw className={`w-4 h-4 ${isRebuilding ? 'animate-spin text-primary' : ''}`} />
            </button>

            {/* New Document Button */}
            <button
              onClick={() => setIsNewDocOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium flex items-center gap-1.5 shadow-subtle transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>새 문서</span>
            </button>
          </div>
        </div>

        {/* Bottom row: Search & Filter Chips */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="한국어/영문 전문 검색 (FTS5 trigram)..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <button
                onClick={async () => {
                  const name = prompt('새 스마트 그룹의 이름을 입력하세요:', searchQuery.trim())
                  if (name && name.trim()) {
                    await window.markflowApi.saveSmartGroup({
                      name: name.trim(),
                      query: searchQuery.trim()
                    })
                    alert(`스마트 그룹 '${name.trim()}'이 사이드바에 저장되었습니다!`)
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium whitespace-nowrap transition-colors border border-border/40"
                title="이 검색 조건을 사이드바 스마트 그룹으로 저장"
              >
                스마트 그룹 저장
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Status Filter */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-[11px]">상태:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 rounded-md bg-muted/40 border border-border/60 text-xs text-foreground focus:outline-none"
              >
                <option value="">전체 상태</option>
                <option value="inbox">수집함</option>
                <option value="review_needed">검토 필요</option>
                <option value="ready">준비 완료</option>
                <option value="exported">내보냄</option>
                <option value="archived">보관됨</option>
              </select>
            </div>

            {/* Category Filter */}
            {allCategories.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-[11px]">분류:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2 py-1 rounded-md bg-muted/40 border border-border/60 text-xs text-foreground focus:outline-none"
                >
                  <option value="">전체 분류</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-2 py-1 rounded-md bg-muted/40 border border-border/60 text-xs text-foreground focus:outline-none"
            >
              <option value="latest">최신 변환순</option>
              <option value="name">문서 이름순</option>
              <option value="score">품질 점수순</option>
            </select>

            {/* Include Archived toggle */}
            <label className="flex items-center gap-1.5 text-muted-foreground text-[11px] cursor-pointer pl-1">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-0"
              />
              <span>보관 문서 포함</span>
            </label>
          </div>
        </div>
      </header>

      {/* 2. Board Body: Render Active View */}
      {documents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Search className="w-6 h-6 opacity-60" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {searchQuery ? `'${searchQuery}' 검색 결과가 없습니다` : '라이브러리가 비어 있습니다'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            {searchQuery
              ? '다른 검색어나 필터를 변경해 보세요.'
              : '수집함에서 문서를 변환하거나 [+ 새 문서] 버튼을 눌러 새 마크다운을 작성하세요.'}
          </p>
          <button
            onClick={() => setIsNewDocOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover shadow-subtle transition-colors"
          >
            새 문서 작성하기
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <BoardListView
              documents={documents}
              selectedSlugs={selectedSlugs}
              onToggleSelect={handleToggleSelect}
              onOpenDetail={onOpenDetail}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}

          {viewMode === 'table' && (
            <BoardTableView
              documents={documents}
              selectedSlugs={selectedSlugs}
              onToggleSelect={handleToggleSelect}
              onOpenDetail={onOpenDetail}
              onUpdateFrontmatter={handleUpdateFrontmatter}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}

          {viewMode === 'kanban' && (
            <BoardKanbanView
              documents={documents}
              onOpenDetail={onOpenDetail}
              onUpdateFrontmatter={handleUpdateFrontmatter}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          )}

          {viewMode === 'gallery' && (
            <BoardGalleryView
              documents={documents}
              selectedSlugs={selectedSlugs}
              onToggleSelect={handleToggleSelect}
              onOpenDetail={onOpenDetail}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      {/* 3. Floating Batch Action Bar (When 1+ documents selected) */}
      {selectedSlugs.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-card/95 backdrop-blur-md border border-border px-4 py-2.5 rounded-xl shadow-floating flex items-center gap-3 animate-slide-up text-xs select-none">
          <span className="font-semibold text-foreground">
            {selectedSlugs.size}개 선택됨
          </span>

          <div className="h-4 w-px bg-border" />

          {/* Change Status Dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) handleBatchStatus(e.target.value)
            }}
            defaultValue=""
            className="px-2 py-1 rounded bg-muted text-foreground text-xs border border-border/60 focus:outline-none"
          >
            <option value="" disabled>
              상태 변경...
            </option>
            <option value="inbox">수집함으로</option>
            <option value="review_needed">검토 필요로</option>
            <option value="ready">준비 완료로</option>
            <option value="archived">보관함으로</option>
          </select>

          {/* Export Buttons */}
          <button
            onClick={() => handleBatchExport('folder')}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-semibold whitespace-nowrap"
            title="원하는 폴더를 직접 선택하여 저장"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>폴더 선택 저장</span>
          </button>
          <button
            onClick={() => handleBatchExport('github')}
            className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium whitespace-nowrap"
          >
            GitHub
          </button>
          <button
            onClick={() => handleBatchExport('obsidian')}
            className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium whitespace-nowrap"
          >
            Obsidian
          </button>

          <div className="relative">
            <button
              onClick={() => setMoreExportOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors font-semibold whitespace-nowrap"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>클라우드 · 더보기</span>
              <ChevronUp className="w-3 h-3 opacity-80" />
            </button>

            <ExportDropdownMenu
              isOpen={moreExportOpen}
              onClose={() => setMoreExportOpen(false)}
              onSelectTarget={(target) => handleBatchExport(target)}
              align="center-up"
            />
          </div>

          {/* Delete Button */}
          <button
            onClick={handleBatchDelete}
            className="px-2 py-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
            title="선택한 문서 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-border" />

          <button
            onClick={() => setSelectedSlugs(new Set())}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 4. New Document Modal */}
      <NewDocumentModal
        isOpen={isNewDocOpen}
        onClose={() => setIsNewDocOpen(false)}
        onCreate={handleCreateDocument}
      />
    </div>
  )
}
