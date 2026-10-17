import React from 'react'
import { Github, Folder, Zap, X } from 'lucide-react'

interface ExportActionBarProps {
  selectedCount: number
  onExport: (target: 'github' | 'obsidian' | 'both') => void
  onClearSelection: () => void
}

export const ExportActionBar: React.FC<ExportActionBarProps> = ({
  selectedCount,
  onExport,
  onClearSelection
}) => {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-stone-900/90 dark:bg-stone-800/95 text-white backdrop-blur-md rounded-2xl shadow-xl border border-stone-700/50 text-xs">
        {/* Selected count info */}
        <div className="flex items-center gap-2 pr-2 border-r border-stone-700">
          <span className="font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[11px]">
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport('github')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors font-medium border border-stone-700"
          >
            <Github size={13} className="text-blue-400" />
            GitHub로
          </button>

          <button
            onClick={() => onExport('obsidian')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors font-medium border border-stone-700"
          >
            <Folder size={13} className="text-purple-400" />
            Obsidian으로
          </button>

          <button
            onClick={() => onExport('both')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-sm"
          >
            <Zap size={13} className="text-amber-300" />
            둘 다 내보내기
          </button>
        </div>
      </div>
    </div>
  )
}
