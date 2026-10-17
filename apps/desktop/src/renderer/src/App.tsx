import React, { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { EmptyState } from './components/EmptyState'
import { EngineStatus } from '../../preload'
import { Plus } from 'lucide-react'

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('inbox')
  const [isDark, setIsDark] = useState(false)
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    state: 'starting',
    port: null
  })

  // Theme toggle effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  // Connect to Electron sidecar status
  useEffect(() => {
    if (window.markflowApi) {
      // Get initial status
      window.markflowApi.getEngineStatus().then((status) => {
        if (status) setEngineStatus(status)
      })

      // Subscribe to live status changes
      const unsubscribe = window.markflowApi.onEngineStatusChange((status) => {
        setEngineStatus(status)
      })

      return () => {
        unsubscribe()
      }
    } else {
      // Browser fallback (for preview/tests)
      setEngineStatus({
        state: 'ready',
        port: 8000,
        version: '0.1.0',
        markitdownVersion: '0.1.8'
      })
    }
  }, [])

  const handleRetryEngine = () => {
    if (window.markflowApi) {
      setEngineStatus((prev) => ({ ...prev, state: 'starting', error: undefined }))
      window.markflowApi.restartEngine().then((status) => {
        if (status) setEngineStatus(status)
      })
    }
  }

  const getViewTitle = () => {
    switch (currentView) {
      case 'inbox':
        return { title: '수집함', subtitle: '새로 들어온 문서를 분류하세요' }
      case 'today':
        return { title: '오늘', subtitle: '오늘 확인하거나 처리할 문서입니다' }
      case 'review':
        return { title: '검토 필요', subtitle: '변환 품질 보강이 필요한 문서입니다' }
      case 'library':
        return { title: '라이브러리', subtitle: '보관된 모든 Markdown 문서를 검색하세요' }
      case 'logbook':
        return { title: '기록', subtitle: '문서 변환 및 내보내기 활동 내역입니다' }
      default:
        return { title: 'MarkFlow', subtitle: '' }
    }
  }

  const viewMeta = getViewTitle()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 1. Left Sidebar (Fixed 2-area Things style) */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        engineStatus={engineStatus}
        onRetryEngine={handleRetryEngine}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
      />

      {/* 2. Right Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
        {/* Top Header: Large Clean Title + Subtitle */}
        <header className="px-8 pt-7 pb-4 shrink-0 border-b border-border/40 select-text">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {viewMeta.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {viewMeta.subtitle}
          </p>
        </header>

        {/* Content Body: Empty State for Phase 1 */}
        <div className="flex-1 overflow-auto p-6 flex flex-col justify-center items-center">
          <EmptyState />
        </div>

        {/* Floating Action Button (+) Things Style */}
        <button
          className="absolute bottom-6 right-6 w-11 h-11 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground shadow-floating flex items-center justify-center transition-all duration-fast hover:scale-105 active:scale-95"
          title="새 문서 추가"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </main>
    </div>
  )
}
export default App
