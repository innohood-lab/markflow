import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { SplitPane } from './components/SplitPane'
import { QueueSection, QueueItem } from './components/QueueSection'
import { HistorySection } from './components/HistorySection'
import { MarkdownPreview } from './components/MarkdownPreview'
import { ToastUndo } from './components/ToastUndo'
import { EmptyState } from './components/EmptyState'
import { EngineStatus, ConversionRecord } from '../../preload'
import { Plus } from 'lucide-react'

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('inbox')
  const [isDark, setIsDark] = useState(false)
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    state: 'starting',
    port: null
  })

  // Phase 2 & 3 state: Queue, Profile & History
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [profile, setProfile] = useState<'balanced' | 'fast' | 'best_quality'>('balanced')
  const [autoConvert, setAutoConvert] = useState(true)
  const [historyItems, setHistoryItems] = useState<ConversionRecord[]>([])
  const [selectedItem, setSelectedItem] = useState<ConversionRecord | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'latest' | 'name'>('latest')
  const [activeConversions, setActiveConversions] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [undoToast, setUndoToast] = useState<{ message: string; recordId: number } | null>(null)

  // Track active conversion count using ref for accurate queue scheduling
  const activeCountRef = useRef(0)
  activeCountRef.current = activeConversions

  // Theme toggle effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  // Fetch history from SQLite
  const loadHistory = useCallback(async () => {
    if (window.markflowApi) {
      try {
        const records = await window.markflowApi.getHistory({
          search: searchQuery,
          sort: sortOrder,
          reviewOnly: currentView === 'review'
        })
        setHistoryItems(records || [])

        const count = await window.markflowApi.getReviewCount()
        setReviewCount(count || 0)

        // If selected item exists, refresh its content
        if (selectedItem) {
          const fresh = records?.find((r) => r.id === selectedItem.id)
          if (fresh) setSelectedItem(fresh)
        }
      } catch (err) {
        console.error('[App] Failed to load history:', err)
      }
    }
  }, [searchQuery, sortOrder, currentView, selectedItem])

  useEffect(() => {
    loadHistory()
  }, [searchQuery, sortOrder, currentView])

  // Connect to Electron sidecar status
  useEffect(() => {
    if (window.markflowApi) {
      window.markflowApi.getEngineStatus().then((status) => {
        if (status) setEngineStatus(status)
      })

      const unsubscribe = window.markflowApi.onEngineStatusChange((status) => {
        setEngineStatus(status)
      })

      loadHistory()
      return () => unsubscribe()
    } else {
      setEngineStatus({
        state: 'ready',
        port: 8000,
        version: '0.1.0',
        markitdownVersion: '0.1.8'
      })
    }
  }, [])

  // Retry engine connection
  const handleRetryEngine = () => {
    if (window.markflowApi) {
      setEngineStatus((prev) => ({ ...prev, state: 'starting', error: undefined }))
      window.markflowApi.restartEngine().then((status) => {
        if (status) setEngineStatus(status)
      })
    }
  }

  // Add files to queue
  const handleAddFiles = (files: { path: string; name: string; size: number }[]) => {
    const newItems: QueueItem[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      path: f.path,
      name: f.name,
      size: f.size,
      status: 'pending'
    }))

    setQueue((prev) => [...prev, ...newItems])
  }

  // Remove single item from queue
  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }

  // Clear entire queue
  const handleClearQueue = () => {
    setQueue((prev) => prev.filter((item) => item.status === 'converting'))
  }

  // Process a single queue item
  const processItem = async (item: QueueItem) => {
    if (!window.markflowApi) return

    // Mark as converting
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'converting' } : q))
    )
    setActiveConversions((c) => c + 1)

    try {
      const res = await window.markflowApi.convertDocument(item.path, undefined, profile)

      if (res.status === 'success') {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'done' } : q))
        )
        // Refresh history and auto-select newly converted document
        const updatedHistory = await window.markflowApi.getHistory({
          search: searchQuery,
          sort: sortOrder,
          reviewOnly: currentView === 'review'
        })
        setHistoryItems(updatedHistory || [])

        const count = await window.markflowApi.getReviewCount()
        setReviewCount(count || 0)

        const converted = updatedHistory?.find((h) => h.slug === res.slug)
        if (converted) {
          setSelectedItem(converted)
        }
      } else if (res.status === 'unsupported') {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'unsupported', errorMessage: res.message } : q
          )
        )
      } else {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'failed', errorMessage: res.message } : q
          )
        )
      }
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: 'failed', errorMessage: err?.message || String(err) } : q
        )
      )
    } finally {
      setActiveConversions((c) => Math.max(0, c - 1))
    }
  }

  // Concurrency queue processor (max 2 parallel conversions)
  useEffect(() => {
    if (!autoConvert && activeConversions === 0) return

    const pendingItems = queue.filter((i) => i.status === 'pending')
    const availableSlots = 2 - activeConversions

    if (pendingItems.length > 0 && availableSlots > 0 && engineStatus.state === 'ready') {
      const toProcess = pendingItems.slice(0, availableSlots)
      for (const item of toProcess) {
        processItem(item)
      }
    }
  }, [queue, activeConversions, autoConvert, engineStatus.state])

  // Trigger convert all manually
  const handleConvertAll = () => {
    const pendingItems = queue.filter((i) => i.status === 'pending' || i.status === 'failed')
    const availableSlots = 2 - activeConversions
    if (availableSlots > 0) {
      const toProcess = pendingItems.slice(0, availableSlots)
      for (const item of toProcess) {
        processItem(item)
      }
    }
  }

  // Delete document with undo toast
  const handleDeleteItem = async (id: number) => {
    if (!window.markflowApi) return
    const deleted = await window.markflowApi.deleteHistoryItem(id)
    if (deleted) {
      setHistoryItems((prev) => prev.filter((i) => i.id !== id))
      if (selectedItem?.id === id) {
        setSelectedItem(null)
      }
      const count = await window.markflowApi.getReviewCount()
      setReviewCount(count || 0)
      setUndoToast({
        message: `'${deleted.title}' 문서가 삭제되었습니다.`,
        recordId: id
      })
    }
  }

  // Restore document from undo
  const handleUndoDelete = async () => {
    if (!undoToast || !window.markflowApi) return
    const restored = await window.markflowApi.restoreHistoryItem(undoToast.recordId)
    if (restored) {
      setUndoToast(null)
      loadHistory()
      setSelectedItem(restored)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 1. Left Sidebar (Things style) */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        engineStatus={engineStatus}
        onRetryEngine={handleRetryEngine}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        reviewCount={reviewCount}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
        {/* Top Header */}
        <header className="px-6 py-4 shrink-0 border-b border-border/40 select-text flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {currentView === 'review' ? '검토 필요' : '수집함'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentView === 'review'
                ? '품질 점수가 70점 미만이거나 스캔 등 확인이 필요한 문서 목록입니다'
                : '새로 들어온 문서를 분류하고 고품질 Markdown으로 변환하세요'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {currentView === 'review' ? '검토 대상' : '보관 문서'}:{' '}
              <strong className="text-foreground">{historyItems.length}</strong>건
            </span>
          </div>
        </header>

        {/* 2-Pane Split: Left Queue, Right History & Preview */}
        {currentView === 'inbox' || currentView === 'review' ? (
          <SplitPane
            defaultLeftWidthPercent={42}
            minLeftWidth={320}
            minRightWidth={420}
            left={
              <QueueSection
                queue={queue}
                onAddFiles={handleAddFiles}
                onRemoveItem={handleRemoveQueueItem}
                onClearQueue={handleClearQueue}
                onConvertAll={handleConvertAll}
                onRetryItem={(id) => {
                  setQueue((prev) =>
                    prev.map((q) => (q.id === id ? { ...q, status: 'pending', errorMessage: undefined } : q))
                  )
                }}
                autoConvert={autoConvert}
                onToggleAutoConvert={setAutoConvert}
                isConverting={activeConversions > 0}
                profile={profile}
                onProfileChange={setProfile}
              />
            }
            right={
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Upper Right: History List (Takes top half if preview open, full if not) */}
                <div
                  className={`overflow-hidden transition-all duration-normal flex flex-col ${
                    selectedItem ? 'h-64 border-b border-border/60 shrink-0' : 'flex-1'
                  }`}
                >
                  <HistorySection
                    items={historyItems}
                    selectedItem={selectedItem}
                    onSelectItem={setSelectedItem}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortOrder={sortOrder}
                    onSortChange={setSortOrder}
                    onDelete={handleDeleteItem}
                  />
                </div>

                {/* Lower Right: Rendered Markdown Preview */}
                {selectedItem && (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <MarkdownPreview
                      item={selectedItem}
                      onDelete={handleDeleteItem}
                    />
                  </div>
                )}
              </div>
            }
          />
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center">
            <EmptyState
              title={`${currentView} 화면 준비 중`}
              description="이 기능은 다음 단계에서 연결됩니다."
            />
          </div>
        )}

        {/* Floating Quick Add (+) Button */}
        <button
          onClick={async () => {
            if (window.markflowApi) {
              const selected = await window.markflowApi.selectFilesOrFolders()
              if (selected.length > 0) handleAddFiles(selected)
            }
          }}
          className="absolute bottom-6 right-6 w-11 h-11 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground shadow-floating flex items-center justify-center transition-all duration-fast hover:scale-105 active:scale-95"
          title="문서 추가 (파일 또는 폴더 선택)"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Undo Toast Notification (Things style) */}
        {undoToast && (
          <ToastUndo
            message={undoToast.message}
            onUndo={handleUndoDelete}
            onDismiss={() => setUndoToast(null)}
          />
        )}
      </main>
    </div>
  )
}
export default App
