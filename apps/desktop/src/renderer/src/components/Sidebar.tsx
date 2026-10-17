import React from 'react'
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
  ChevronRight
} from 'lucide-react'
import { EngineStatus } from '../../../preload'
import { EngineStatusDot } from './EngineStatusDot'

interface SidebarProps {
  currentView: string
  onSelectView: (view: string) => void
  engineStatus: EngineStatus
  onRetryEngine: () => void
  isDark: boolean
  onToggleTheme: () => void
  reviewCount?: number
  onOpenSettings?: () => void
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
  const topNavItems = [
    { id: 'inbox', label: '수집함', icon: Inbox },
    { id: 'today', label: '오늘', icon: Star },
    { id: 'review', label: '검토 필요', icon: AlertCircle, count: reviewCount },
    { id: 'library', label: '라이브러리', icon: BookOpen },
    { id: 'logbook', label: '기록', icon: Calendar }
  ]

  return (
    <aside className="w-64 h-full bg-sidebar flex flex-col border-r border-sidebar-border select-none shrink-0 transition-colors duration-normal">
      {/* Top Header / App Brand (Things style minimal) */}
      <div className="h-12 flex items-center px-4 font-semibold text-sm tracking-tight text-foreground gap-2">
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

      {/* Middle: Areas & Projects (Hierarchy) */}
      <div className="flex-1 overflow-y-auto px-2 mt-6 space-y-4">
        <div>
          <div className="px-2.5 mb-1 text-[11px] font-semibold text-sidebar-foreground/70 tracking-wider uppercase">
            영역
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-sidebar-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/40">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <Folder className="w-3.5 h-3.5 text-muted-foreground" />
              <span>업무</span>
            </div>
            <div className="pl-6 space-y-0.5">
              <div className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/30 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span>AX 추진</span>
              </div>
              <div className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/30 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span>B.Argos</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-sidebar-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/40 mt-1">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <Folder className="w-3.5 h-3.5 text-muted-foreground" />
              <span>개인</span>
            </div>
          </div>
        </div>

        <div>
          <div className="px-2.5 mb-1 text-[11px] font-semibold text-sidebar-foreground/70 tracking-wider uppercase">
            스마트 그룹 & 태그
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-sidebar-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/40">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span>보고서</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-sidebar-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/40">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span>기획안</span>
            </div>
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
