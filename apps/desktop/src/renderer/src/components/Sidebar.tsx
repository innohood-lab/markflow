import React, { useState, useEffect } from 'react'
import {
  Inbox,
  Star,
  AlertCircle,
  BookOpen,
  Calendar,
  Folder,
  Tag,
  Settings,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Share2,
  Layers,
  Highlighter
} from 'lucide-react'
import { EngineStatus } from '../../../preload'
import { EngineStatusDot } from './EngineStatusDot'

interface SidebarProps {
  currentView: string
  onSelectView: (view: string, extraData?: any) => void
  engineStatus: EngineStatus
  onRetryEngine: () => void
  isDark: boolean
  onToggleTheme: () => void
  reviewCount?: number
  onOpenSettings?: () => void
}

interface ProjectItem {
  id: string
  name: string
  groupPath: string
}

interface AreaItem {
  id: string
  name: string
  projects: ProjectItem[]
}

interface SmartGroupItem {
  id: string
  name: string
  query: string
  icon?: string
  isDefault?: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  engineStatus,
  onRetryEngine,
  isDark,
  onToggleTheme,
  reviewCount = 0,
  onOpenSettings
}) => {
  const [areas, setAreas] = useState<AreaItem[]>([])
  const [smartGroups, setSmartGroups] = useState<SmartGroupItem[]>([])
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set())
  const [dragOverProject, setDragOverProject] = useState<string | null>(null)

  // Adding state
  const [isAddingArea, setIsAddingArea] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [addingProjectAreaId, setAddingProjectAreaId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')

  // Load areas and smart groups
  const loadSidebarData = async () => {
    if (window.markflowApi?.getAreas) {
      try {
        const loadedAreas = await window.markflowApi.getAreas()
        if (loadedAreas) setAreas(loadedAreas)
        const loadedSmartGroups = await window.markflowApi.getSmartGroups()
        if (loadedSmartGroups) setSmartGroups(loadedSmartGroups)
      } catch (err) {
        console.error('[Sidebar] Failed to load areas or smart groups:', err)
      }
    }
  }

  useEffect(() => {
    loadSidebarData()
  }, [])

  const topNavItems = [
    { id: 'inbox', label: '수집함', icon: Inbox },
    { id: 'today', label: '오늘', icon: Star },
    { id: 'review', label: '검토 필요', icon: AlertCircle, count: reviewCount },
    { id: 'library', label: '라이브러리', icon: BookOpen },
    { id: 'highlights', label: '하이라이트 모음', icon: Highlighter },
    { id: 'logbook', label: '기록', icon: Calendar }
  ]

  const toggleCollapseArea = (areaId: string) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }

  // Area / Project CRUD
  const handleAddArea = async () => {
    if (!newAreaName.trim()) return
    const updated = await window.markflowApi.addArea(newAreaName.trim())
    if (updated) setAreas(updated)
    setNewAreaName('')
    setIsAddingArea(false)
  }

  const handleAddProject = async (areaId: string) => {
    if (!newProjectName.trim()) return
    const updated = await window.markflowApi.addProject(areaId, newProjectName.trim())
    if (updated) setAreas(updated)
    setNewProjectName('')
    setAddingProjectAreaId(null)
  }

  const handleDeleteAreaOrProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = await window.markflowApi.deleteAreaOrProject(id)
    if (updated) setAreas(updated)
  }

  const handleDeleteSmartGroup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = await window.markflowApi.deleteSmartGroup(id)
    if (updated) setSmartGroups(updated)
  }

  // Document Drag & Drop to Project (DEVONthink Replicant)
  const handleDragOverProject = (e: React.DragEvent, projectPath: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = e.altKey ? 'move' : 'copy'
    if (dragOverProject !== projectPath) {
      setDragOverProject(projectPath)
    }
  }

  const handleDropOnProject = async (e: React.DragEvent, projectPath: string) => {
    e.preventDefault()
    const slug = e.dataTransfer.getData('text/plain')
    const replace = e.altKey // Option/Alt key switches to move mode
    if (slug) {
      await window.markflowApi.assignDocumentToGroup(slug, projectPath, replace)
      // Feedback or refresh
      console.log(`[Sidebar] Assigned document ${slug} to ${projectPath} (replace: ${replace})`)
    }
    setDragOverProject(null)
  }

  const getSmartGroupIcon = (iconName?: string) => {
    switch (iconName) {
      case 'AlertCircle':
        return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
      case 'Calendar':
        return <Calendar className="w-3.5 h-3.5 text-blue-500" />
      case 'Share2':
        return <Share2 className="w-3.5 h-3.5 text-teal-500" />
      default:
        return <Layers className="w-3.5 h-3.5 text-primary" />
    }
  }

  return (
    <aside className="w-64 h-full bg-sidebar flex flex-col border-r border-sidebar-border select-none shrink-0 transition-colors duration-normal">
      {/* Top Header / App Brand (Things style minimal) */}
      <div
        className={`h-12 flex items-center ${
          typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
            ? 'pl-20 pr-4'
            : 'px-4'
        } font-semibold text-sm tracking-tight text-foreground gap-2 shrink-0 app-drag-region`}
      >
        <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-subtle">
          M
        </div>
        <span>MarkFlow</span>
      </div>

      {/* Main Navigation (Fixed top section) */}
      <div className="px-2 space-y-0.5 mt-1">
        {topNavItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-subtle'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-primary' : 'text-sidebar-foreground/80'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span className="text-xs px-1.5 py-0.2 rounded-full bg-sidebar-border text-sidebar-foreground font-semibold">
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Middle: Areas & Projects (DEVONthink Group Hierarchy) */}
      <div className="flex-1 overflow-y-auto px-2 mt-5 space-y-4">
        {/* 1. Areas & Projects */}
        <div>
          <div className="px-2.5 mb-1 flex items-center justify-between text-[11px] font-semibold text-sidebar-foreground/70 tracking-wider uppercase">
            <span>영역</span>
            <button
              onClick={() => setIsAddingArea(true)}
              className="p-0.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-foreground"
              title="새 영역 추가"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New Area Input */}
          {isAddingArea && (
            <div className="px-2 mb-1.5">
              <input
                type="text"
                autoFocus
                placeholder="영역 이름 (예: 업무)"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddArea()
                  if (e.key === 'Escape') setIsAddingArea(false)
                }}
                className="w-full px-2 py-1 rounded bg-sidebar-accent border border-sidebar-border text-xs text-foreground focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1">
            {areas.map((area) => {
              const isCollapsed = collapsedAreas.has(area.id)

              return (
                <div key={area.id} className="space-y-0.5">
                  {/* Area Title Row */}
                  <div className="group flex items-center justify-between px-2 py-1 rounded-md text-xs text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/40 cursor-pointer">
                    <div
                      onClick={() => toggleCollapseArea(area.id)}
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{area.name}</span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAddingProjectAreaId(area.id)
                        }}
                        className="p-0.5 hover:text-primary"
                        title="프로젝트 추가"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteAreaOrProject(area.id, e)}
                        className="p-0.5 hover:text-destructive"
                        title="영역 삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Adding Project Input */}
                  {addingProjectAreaId === area.id && (
                    <div className="pl-6 pr-2 py-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="프로젝트 이름 (예: AX 추진)"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddProject(area.id)
                          if (e.key === 'Escape') setAddingProjectAreaId(null)
                        }}
                        className="w-full px-2 py-0.5 rounded bg-sidebar-accent border border-sidebar-border text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Projects List under Area */}
                  {!isCollapsed && (
                    <div className="pl-5 space-y-0.5">
                      {area.projects.map((proj) => {
                        const isSelected = currentView === `group:${proj.groupPath}`
                        const isDragOver = dragOverProject === proj.groupPath

                        return (
                          <div
                            key={proj.id}
                            onDragOver={(e) => handleDragOverProject(e, proj.groupPath)}
                            onDragLeave={() => setDragOverProject(null)}
                            onDrop={(e) => handleDropOnProject(e, proj.groupPath)}
                            onClick={() => onSelectView(`group:${proj.groupPath}`, { group: proj.groupPath })}
                            className={`group/proj flex items-center justify-between px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                              isDragOver
                                ? 'bg-primary/20 text-primary ring-1 ring-primary'
                                : isSelected
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
                              <span className="truncate">{proj.name}</span>
                            </div>

                            <button
                              onClick={(e) => handleDeleteAreaOrProject(proj.id, e)}
                              className="opacity-0 group-hover/proj:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                              title="프로젝트 삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}

                      {area.projects.length === 0 && addingProjectAreaId !== area.id && (
                        <div
                          onClick={() => setAddingProjectAreaId(area.id)}
                          className="px-2 py-0.5 text-[11px] text-muted-foreground/60 hover:text-primary cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>프로젝트 추가</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 2. Smart Groups */}
        <div>
          <div className="px-2.5 mb-1 text-[11px] font-semibold text-sidebar-foreground/70 tracking-wider uppercase flex items-center justify-between">
            <span>스마트 그룹</span>
          </div>

          <div className="space-y-0.5">
            {smartGroups.map((group) => {
              const isSelected = currentView === `smart:${group.id}`

              return (
                <div
                  key={group.id}
                  onClick={() => onSelectView(`smart:${group.id}`, { smartQuery: group.query, smartTitle: group.name })}
                  className={`group/sg flex items-center justify-between px-2.5 py-1 text-xs rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                      : 'text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    {getSmartGroupIcon(group.icon)}
                    <span className="truncate">{group.name}</span>
                  </div>

                  {!group.isDefault && (
                    <button
                      onClick={(e) => handleDeleteSmartGroup(group.id, e)}
                      className="opacity-0 group-hover/sg:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity"
                      title="스마트 그룹 삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom Footer: Engine Status Dot & Settings */}
      <div className="p-2 border-t border-sidebar-border flex items-center justify-between">
        <EngineStatusDot status={engineStatus} onRetry={onRetryEngine} />

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-foreground transition-colors"
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground hover:text-foreground transition-colors"
            title="내보내기 및 환경 설정"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
