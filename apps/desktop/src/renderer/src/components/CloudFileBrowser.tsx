import React, { useState, useEffect } from 'react'
import {
  Cloud,
  Folder,
  FileText,
  ChevronRight,
  HardDrive,
  RefreshCw,
  Plus,
  CloudOff,
  AlertCircle,
  FolderPlus
} from 'lucide-react'

interface CloudFileBrowserProps {
  onAddFiles: (files: { path: string; name: string; size: number; sourceLocation?: string }[]) => void
}

export const CloudFileBrowser: React.FC<CloudFileBrowserProps> = ({ onAddFiles }) => {
  const [providers, setProviders] = useState<any[]>([])
  const [activeProvider, setActiveProvider] = useState<any | null>(null)
  const [currentPath, setCurrentPath] = useState<string>('')
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ name: string; path: string }>>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  // Fetch detected cloud storage folders
  const loadProviders = async () => {
    setLoading(true)
    try {
      const detected = await window.markflowApi.detectCloudProviders()
      setProviders(detected || [])
      if (detected && detected.length > 0 && !activeProvider) {
        selectProvider(detected[0])
      }
    } catch (err) {
      console.error('Failed to detect cloud providers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProviders()
  }, [])

  const selectProvider = async (provider: any) => {
    setActiveProvider(provider)
    setCurrentPath(provider.path)
    setBreadcrumbs([{ name: provider.name, path: provider.path }])
    await loadDirectory(provider.path)
  }

  const loadDirectory = async (folderPath: string) => {
    setLoading(true)
    setSelectedPaths(new Set())
    try {
      const list = await window.markflowApi.listCloudFiles(folderPath)
      setItems(list || [])
    } catch (err) {
      console.error('Failed to list directory:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleNavigateInto = async (item: any) => {
    if (!item.isDirectory) return
    const newBreadcrumbs = [...breadcrumbs, { name: item.name, path: item.path }]
    setBreadcrumbs(newBreadcrumbs)
    setCurrentPath(item.path)
    await loadDirectory(item.path)
  }

  const handleBreadcrumbClick = async (index: number) => {
    const target = breadcrumbs[index]
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1)
    setBreadcrumbs(newBreadcrumbs)
    setCurrentPath(target.path)
    await loadDirectory(target.path)
  }

  const toggleSelect = (pathStr: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(pathStr)) next.delete(pathStr)
      else next.add(pathStr)
      return next
    })
  }

  const handleAddSelectedToQueue = () => {
    const selectedItems = items.filter((i) => selectedPaths.has(i.path) && !i.isDirectory)
    if (selectedItems.length === 0) return

    const providerPrefix = activeProvider?.name || 'Cloud'
    const toAdd = selectedItems.map((item) => ({
      path: item.path,
      name: item.name,
      size: item.size,
      sourceLocation: `${providerPrefix}:${item.path}`
    }))

    onAddFiles(toAdd)
    setSelectedPaths(new Set())
  }

  const handlePickCustomFolder = async () => {
    try {
      const res = await window.markflowApi.pickCloudFolder()
      if (!res.canceled && res.path) {
        const customAcc = {
          id: `custom-${Date.now()}`,
          provider: 'custom',
          name: res.path.split(/[\\/]/).pop() || '사용자 폴더',
          path: res.path,
          isAvailable: true
        }
        setProviders((prev) => [...prev, customAcc])
        selectProvider(customAcc)
      }
    } catch (err) {
      console.error('Failed to pick custom folder:', err)
    }
  }

  const getProviderIconColor = (provider: string) => {
    switch (provider) {
      case 'gdrive':
        return 'text-emerald-500'
      case 'onedrive':
        return 'text-blue-500'
      case 'dropbox':
        return 'text-sky-500'
      case 'icloud':
        return 'text-purple-500'
      default:
        return 'text-stone-500'
    }
  }

  return (
    <div className="flex flex-col h-full bg-card/60 rounded-xl border border-border/80 overflow-hidden text-xs">
      {/* Top: Provider Chips */}
      <div className="flex items-center gap-1.5 p-3 border-b border-border/60 bg-muted/30 overflow-x-auto shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
          <Cloud size={13} />
          저장소:
        </span>

        {providers.length === 0 && !loading && (
          <span className="text-[11px] text-muted-foreground">감지된 클라우드 폴더 없음</span>
        )}

        {providers.map((p) => {
          const isActive = activeProvider?.id === p.id
          return (
            <button
              key={p.id}
              onClick={() => selectProvider(p)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all shrink-0 font-medium ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-subtle'
                  : 'bg-card text-foreground hover:bg-muted border border-border/60'
              }`}
            >
              <HardDrive size={12} className={isActive ? 'text-primary-foreground' : getProviderIconColor(p.provider)} />
              <span>{p.name}</span>
            </button>
          )
        })}

        <button
          onClick={handlePickCustomFolder}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 text-[11px] shrink-0"
          title="클라우드 동기화 폴더 직접 추가"
        >
          <FolderPlus size={12} />
          <span>폴더 추가</span>
        </button>

        <button
          onClick={loadProviders}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-auto"
          title="새로고침"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Middle: Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/10 border-b border-border/40 text-[11px] text-muted-foreground overflow-x-auto shrink-0">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight size={11} className="shrink-0 text-muted-foreground/60" />}
              <button
                onClick={() => handleBreadcrumbClick(idx)}
                className={`hover:text-primary truncate max-w-[120px] transition-colors ${
                  idx === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : ''
                }`}
                title={crumb.name}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <RefreshCw size={18} className="animate-spin text-primary" />
            <span className="text-[11px]">파일 목록 불러오는 중...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-1">
            <Folder size={24} className="stroke-[1.2] opacity-40 mb-1" />
            <span>이 폴더에 지원되는 문서가 없습니다</span>
          </div>
        ) : (
          items.map((item) => {
            const isChecked = selectedPaths.has(item.path)
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.isDirectory) handleNavigateInto(item)
                  else if (item.isSupported) toggleSelect(item.path)
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-primary/10 border border-primary/20 text-primary'
                    : 'hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {!item.isDirectory && item.isSupported && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleSelect(item.path)
                      }}
                      className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                    />
                  )}

                  {item.isDirectory ? (
                    <Folder size={14} className="text-amber-500 shrink-0" />
                  ) : (
                    <FileText size={14} className="text-muted-foreground shrink-0" />
                  )}

                  <span className={`truncate ${item.isDirectory ? 'font-medium' : ''}`}>
                    {item.name}
                  </span>

                  {item.isPlaceholder && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0"
                      title="온라인 전용 파일: 클라우드에서 내려받은 후 변환됩니다"
                    >
                      <Cloud size={9} />
                      온라인
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                  {item.isDirectory ? (
                    <ChevronRight size={12} className="opacity-60" />
                  ) : (
                    <span>{(item.size / 1024).toFixed(0)} KB</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer: Selection actions */}
      {selectedPaths.size > 0 && (
        <div className="p-2.5 border-t border-border/60 bg-muted/20 flex items-center justify-between shrink-0 animate-fade-in">
          <span className="text-[11px] font-semibold text-primary">
            {selectedPaths.size}개 문서 선택됨
          </span>
          <button
            onClick={handleAddSelectedToQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold shadow-subtle transition-all"
          >
            <Plus size={13} />
            <span>대기열에 추가</span>
          </button>
        </div>
      )}
    </div>
  )
}
