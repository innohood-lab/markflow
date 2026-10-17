import React, { useState, useEffect } from 'react'
import { ConversionRecord } from '../../../../preload'
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Image as ImageIcon,
  Copy,
  Archive,
  Trash2
} from 'lucide-react'

interface BoardGalleryViewProps {
  documents: ConversionRecord[]
  selectedSlugs: Set<string>
  onToggleSelect: (slug: string) => void
  onOpenDetail: (doc: ConversionRecord) => void
  onDuplicate: (slug: string) => void
  onArchive: (slug: string, isArchived: boolean) => void
  onDelete: (id: number) => void
}

export const BoardGalleryView: React.FC<BoardGalleryViewProps> = ({
  documents,
  selectedSlugs,
  onToggleSelect,
  onOpenDetail,
  onDuplicate,
  onArchive,
  onDelete
}) => {
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})

  // Resolve relative asset images via Electron preload API
  useEffect(() => {
    let isMounted = true
    const resolveImages = async () => {
      for (const doc of documents) {
        if (doc.first_image && !assetUrls[doc.first_image]) {
          if (doc.first_image.startsWith('assets/')) {
            try {
              const dataUrl = await window.markflowApi?.getAssetDataUrl(doc.first_image)
              if (dataUrl && isMounted) {
                setAssetUrls((prev) => ({ ...prev, [doc.first_image!]: dataUrl }))
              }
            } catch {}
          } else if (doc.first_image.startsWith('data:') || doc.first_image.startsWith('http')) {
            if (isMounted) {
              setAssetUrls((prev) => ({ ...prev, [doc.first_image!]: doc.first_image! }))
            }
          }
        }
      }
    }
    resolveImages()
    return () => {
      isMounted = false
    }
  }, [documents])

  const getSourceTypeIcon = (type?: string) => {
    switch (type) {
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-8 h-8 text-emerald-500/80" />
      case 'pptx':
        return <Presentation className="w-8 h-8 text-orange-500/80" />
      case 'html':
      case 'json':
      case 'xml':
        return <FileCode className="w-8 h-8 text-purple-500/80" />
      default:
        return <FileText className="w-8 h-8 text-blue-500/80" />
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 select-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {documents.map((doc) => {
          const isSelected = selectedSlugs.has(doc.slug)
          const isArchived = doc.status === 'archived'
          const previewImg = doc.first_image ? assetUrls[doc.first_image] : null

          return (
            <div
              key={doc.slug}
              onClick={() => onOpenDetail(doc)}
              className={`group bg-card rounded-xl border overflow-hidden shadow-subtle hover:shadow-floating transition-all duration-fast flex flex-col cursor-pointer ${
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/70 hover:border-border'
              }`}
            >
              {/* Card Thumbnail Area */}
              <div className="h-36 bg-muted/40 relative flex items-center justify-center overflow-hidden border-b border-border/40">
                {previewImg ? (
                  <img
                    src={previewImg}
                    alt={doc.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-normal"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 opacity-60">
                    {getSourceTypeIcon(doc.source_type)}
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      {doc.source_type || 'md'}
                    </span>
                  </div>
                )}

                {/* Top Overlay: Checkbox */}
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect(doc.slug)
                  }}
                  className="absolute top-2 left-2 p-1 rounded-md bg-card/80 backdrop-blur-sm shadow-subtle opacity-90 group-hover:opacity-100"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(doc.slug)}
                    className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-0 cursor-pointer"
                  />
                </div>

                {/* Top Overlay: Score Badge */}
                {doc.quality_score !== null && doc.quality_score !== undefined && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-card/90 backdrop-blur-sm shadow-subtle">
                    <span
                      className={
                        doc.quality_score >= 85
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : doc.quality_score >= 70
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {doc.quality_score}점
                    </span>
                  </div>
                )}
              </div>

              {/* Card Info Area */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    {doc.category && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary text-secondary-foreground font-medium">
                        {doc.category}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {doc.converted_at ? doc.converted_at.split('T')[0] : ''}
                    </span>
                  </div>

                  <h3 className={`text-xs font-semibold tracking-tight text-foreground line-clamp-2 mb-2 group-hover:text-primary ${
                    isArchived ? 'line-through text-muted-foreground' : ''
                  }`}>
                    {doc.title || doc.slug}
                  </h3>
                </div>

                {/* Card Tags & Action Hover */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-1 overflow-hidden">
                    {doc.tags && doc.tags.length > 0 ? (
                      doc.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] text-muted-foreground">
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">태그 없음</span>
                    )}
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      onClick={() => onDuplicate(doc.slug)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="문서 복제"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onArchive(doc.slug, !isArchived)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                      title={isArchived ? '보관 해제' : '보관'}
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                    {doc.id && (
                      <button
                        onClick={() => onDelete(doc.id!)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
