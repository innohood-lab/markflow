import React, { useEffect, useState } from 'react'
import { Github, Folder, Zap, Cloud, FolderOpen, HardDrive } from 'lucide-react'

export interface CloudExportOption {
  id: string
  targetKey: string
  name: string
  provider: string
  path: string
  subtitle: string
}

export function useCloudExportOptions(isOpen: boolean): CloudExportOption[] {
  const [options, setOptions] = useState<CloudExportOption[]>([])

  useEffect(() => {
    if (!isOpen || !window.markflowApi) return
    let mounted = true

    async function load() {
      try {
        const [detected, settingsRes] = await Promise.all([
          window.markflowApi.detectCloudProviders?.() || Promise.resolve([]),
          window.markflowApi.getSettings?.() || Promise.resolve({ settings: {} })
        ])
        if (!mounted) return

        const merged: CloudExportOption[] = []
        const seenPaths = new Set<string>()

        const customDests = settingsRes?.settings?.cloudDestinations || []
        for (const d of customDests) {
          if (d?.id && d?.targetPath) {
            seenPaths.add(String(d.targetPath).toLowerCase())
            merged.push({
              id: d.id,
              targetKey: `cloud:${d.id}`,
              name: d.name || '등록된 클라우드 폴더',
              provider: d.provider || 'custom',
              path: d.targetPath,
              subtitle: d.folderRule === 'date' ? 'MarkFlow/연/월 폴더에 저장' : 'MarkFlow 폴더에 저장'
            })
          }
        }

        for (const c of detected || []) {
          if (c?.id && c?.path && !seenPaths.has(String(c.path).toLowerCase())) {
            seenPaths.add(String(c.path).toLowerCase())
            merged.push({
              id: c.id,
              targetKey: `cloud:${c.id}`,
              name: c.name,
              provider: c.provider,
              path: c.path,
              subtitle: `${c.name}/MarkFlow 폴더로 바로 저장`
            })
          }
        }

        setOptions(merged)
      } catch (err) {
        console.warn('[ExportDropdownMenu] Failed to load cloud export options:', err)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [isOpen])

  return options
}

interface ExportDropdownMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelectTarget: (target: string) => void
  align?: 'right' | 'left' | 'center-up'
}

export const ExportDropdownMenu: React.FC<ExportDropdownMenuProps> = ({
  isOpen,
  onClose,
  onSelectTarget,
  align = 'right'
}) => {
  const cloudOptions = useCloudExportOptions(isOpen)

  if (!isOpen) return null

  const posClass =
    align === 'center-up'
      ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
      : align === 'left'
        ? 'left-0 top-full mt-1.5'
        : 'right-0 top-full mt-1.5'

  const handleSelect = (target: string) => {
    onClose()
    onSelectTarget(target)
  }

  return (
    <>
      {/* Invisible backdrop to close on outside click */}
      <div
        className="fixed inset-0 z-30"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />
      <div
        className={`absolute ${posClass} w-64 bg-card border border-border shadow-xl rounded-xl p-1.5 z-40 animate-fade-in text-xs select-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Section 1: Local Folder & Cloud Drives */}
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          로컬 폴더 & 클라우드 드라이브
        </div>

        <button
          type="button"
          onClick={() => handleSelect('folder')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-foreground text-left transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-xs">폴더 직접 선택하여 저장...</div>
            <div className="text-[10px] text-muted-foreground truncate">
              로컬 폴더 · Google Drive · iCloud 등 선택
            </div>
          </div>
        </button>

        {cloudOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.targetKey)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-foreground text-left transition-colors"
            title={opt.path}
          >
            {opt.provider === 'custom' || opt.provider === 'local' ? (
              <HardDrive className="w-4 h-4 text-sky-500 shrink-0" />
            ) : (
              <Cloud className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-xs truncate">{opt.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{opt.subtitle}</div>
            </div>
          </button>
        ))}

        <div className="my-1.5 border-t border-border/60" />

        {/* Section 2: Knowledge Repositories (GitHub & Obsidian) */}
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          지식 저장소 연동
        </div>

        <button
          type="button"
          onClick={() => handleSelect('github')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-foreground text-left transition-colors"
        >
          <Github className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-xs">GitHub LLM-wiki</div>
            <div className="text-[10px] text-muted-foreground">원격 저장소 단일 커밋 업로드</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('obsidian')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-foreground text-left transition-colors"
        >
          <Folder className="w-4 h-4 text-purple-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-xs">Obsidian 보관함</div>
            <div className="text-[10px] text-muted-foreground">설정된 볼트 Inbox 폴더로 복사</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('both')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold text-left transition-colors mt-0.5"
        >
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs">GitHub + Obsidian 동시 내보내기</div>
            <div className="text-[10px] opacity-80 font-normal">원격 위키 및 로컬 볼트 동시 반영</div>
          </div>
        </button>
      </div>
    </>
  )
}
