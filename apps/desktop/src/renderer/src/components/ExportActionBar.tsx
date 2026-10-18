import React, { useState } from 'react'
import { Github, Folder, FolderOpen, Cloud, ChevronUp, X } from 'lucide-react'
import { ExportDropdownMenu } from './ExportDropdownMenu'

interface ExportActionBarProps {
  selectedCount: number
  onExport: (target: string) => void
  onClearSelection: () => void
}

export const ExportActionBar: React.FC<ExportActionBarProps> = ({
  selectedCount,
  onExport,
  onClearSelection
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-stone-900/95 dark:bg-stone-800/95 text-white backdrop-blur-md rounded-2xl shadow-xl border border-stone-700/50 text-xs">
        {/* Selected count info */}
        <div className="flex items-center gap-2 pr-2 border-r border-stone-700">
          <span className="font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[11px] whitespace-nowrap">
            {selectedCount}개 선택
          </span>
          <button
            onClick={onClearSelection}
            title="선택 해제"
            className="p-1 text-stone-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-1.5 relative">
          <button
            onClick={() => onExport('folder')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-semibold shadow-sm whitespace-nowrap"
            title="구글 드라이브, 외장하드, 내 컴퓨터의 원하는 폴더를 직접 선택하여 저장"
          >
            <FolderOpen size={13} />
            폴더 선택 저장
          </button>

          <button
            onClick={() => onExport('github')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors font-medium border border-stone-700 whitespace-nowrap"
          >
            <Github size={13} className="text-blue-400" />
            GitHub
          </button>

          <button
            onClick={() => onExport('obsidian')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors font-medium border border-stone-700 whitespace-nowrap"
          >
            <Folder size={13} className="text-purple-400" />
            Obsidian
          </button>

          <div className="relative">
            <button
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-sm whitespace-nowrap"
              title="구글 드라이브, iCloud, OneDrive 등 클라우드 및 동시 내보내기"
            >
              <Cloud size={13} className="text-sky-200" />
              <span>클라우드 · 더보기</span>
              <ChevronUp size={12} className="opacity-80" />
            </button>

            <ExportDropdownMenu
              isOpen={moreMenuOpen}
              onClose={() => setMoreMenuOpen(false)}
              onSelectTarget={(target) => onExport(target)}
              align="center-up"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

