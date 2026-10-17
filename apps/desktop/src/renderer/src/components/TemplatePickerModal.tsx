import React, { useState, useEffect } from 'react'
import {
  FileText,
  Users,
  Cpu,
  Calendar,
  Plus,
  X,
  Sparkles,
  LayoutTemplate
} from 'lucide-react'

interface TemplateItem {
  id: string
  name: string
  description: string
  icon?: string
  frontmatter: Record<string, any>
  body: string
  isDefault?: boolean
}

interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (templateId: string, customTitle?: string) => Promise<void>
}

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate
}) => {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [selectedId, setSelectedId] = useState<string>('meeting')
  const [customTitle, setCustomTitle] = useState('')
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // New custom template form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newBody, setNewBody] = useState('')

  const loadTemplates = async () => {
    if (window.markflowApi?.getTemplates) {
      const res = await window.markflowApi.getTemplates()
      if (res && res.length > 0) {
        setTemplates(res)
        setSelectedId(res[0].id)
      }
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      setCustomTitle('')
      setIsCreatingNew(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleApply = async () => {
    await onSelectTemplate(selectedId, customTitle.trim() || undefined)
    onClose()
  }

  const handleCreateCustom = async () => {
    if (!newName.trim() || !newBody.trim() || !window.markflowApi?.saveTemplate) return
    const updated = await window.markflowApi.saveTemplate({
      name: newName.trim(),
      description: newDesc.trim(),
      icon: 'FileText',
      frontmatter: { tags: ['커스텀'], status: 'inbox' },
      body: newBody
    })
    setTemplates(updated)
    setIsCreatingNew(false)
    setNewName('')
    setNewDesc('')
    setNewBody('')
  }

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Users':
        return <Users className="w-4 h-4 text-blue-500" />
      case 'Cpu':
        return <Cpu className="w-4 h-4 text-purple-500" />
      case 'Calendar':
        return <Calendar className="w-4 h-4 text-emerald-500" />
      default:
        return <FileText className="w-4 h-4 text-primary" />
    }
  }

  const currentTemplate = templates.find((t) => t.id === selectedId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-floating flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between shrink-0 bg-sidebar-background/40">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {isCreatingNew ? '새 템플릿 만들기' : '템플릿으로 새 문서 만들기'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {isCreatingNew ? (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                템플릿 이름
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 독서 노트, 프로젝트 사후 분석"
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                설명 (선택)
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="템플릿의 용도나 특징을 간단히 입력하세요"
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                마크다운 본문 골격
              </label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="## 1. 개요&#10;내용을 입력하세요..."
                className="w-full h-44 px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 flex-1 overflow-hidden">
            {/* Left Template List (2 cols) */}
            <div className="md:col-span-2 border-r border-border/60 p-3 overflow-y-auto space-y-1.5 bg-sidebar-background/20">
              <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider flex items-center justify-between">
                <span>템플릿 목록</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="text-primary hover:underline flex items-center gap-0.5 text-[11px] font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>새 템플릿</span>
                </button>
              </div>

              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedId(tpl.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                    selectedId === tpl.id
                      ? 'bg-primary text-primary-foreground shadow-subtle font-medium'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="p-1 rounded-lg bg-card/60 border border-border/40 shrink-0 mt-0.5">
                    {getIcon(tpl.icon)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{tpl.name}</div>
                    <div
                      className={`text-[10px] line-clamp-1 mt-0.5 ${
                        selectedId === tpl.id
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {tpl.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Right Preview & Options (3 cols) */}
            <div className="md:col-span-3 p-5 overflow-y-auto flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    문서 제목 (비워둘 시 자동 생성)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={
                      currentTemplate
                        ? `${currentTemplate.name} - ${new Date().toISOString().slice(0, 10)}`
                        : '문서 제목...'
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                    <span>미리보기</span>
                    {currentTemplate?.frontmatter?.category && (
                      <span className="text-[10px] text-primary">
                        카테고리: {currentTemplate.frontmatter.category}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-xs font-mono text-muted-foreground max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                    {currentTemplate?.body || ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/60 bg-sidebar-background/40 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>선택한 템플릿의 서식과 태그가 새 문서에 즉시 적용됩니다.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isCreatingNew ? () => setIsCreatingNew(false) : onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={isCreatingNew ? handleCreateCustom : handleApply}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-subtle"
            >
              {isCreatingNew ? '템플릿 저장' : '이 템플릿으로 생성'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
