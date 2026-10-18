import React from 'react'
import { CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Github, Folder, Cloud, FolderOpen } from 'lucide-react'

export interface ExportProgressModalProps {
  isOpen: boolean
  target: string
  status: 'exporting' | 'success' | 'error'
  message: string
  githubResult?: { commitSha?: string; commitUrl?: string; message: string }
  obsidianResult?: { targetPaths?: string[]; message: string }
  folderResult?: {
    provider: string
    name: string
    targetPath: string
    targetPaths: string[]
    message: string
  }
  errorDetails?: string
  onClose: () => void
  onRetry?: () => void
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  target,
  status,
  message,
  githubResult,
  obsidianResult,
  folderResult,
  errorDetails,
  onClose,
  onRetry
}) => {
  if (!isOpen) return null

  const getTargetTitle = () => {
    if (target === 'github') return 'GitHub LLM-wiki로 내보내기'
    if (target === 'obsidian') return 'Obsidian 보관함으로 내보내기'
    if (target === 'both') return 'GitHub & Obsidian 동시 내보내기'
    if (target === 'folder') return '선택한 폴더로 문서 저장'
    if (target.startsWith('cloud:')) {
      return folderResult?.name ? `${folderResult.name}로 문서 저장` : '클라우드 드라이브로 문서 저장'
    }
    return '문서 저장 및 내보내기'
  }

  const handleOpenSavedFolder = () => {
    const pathToOpen = folderResult?.targetPaths?.[0] || folderResult?.targetPath
    if (pathToOpen && window.markflowApi?.showItemInFolder) {
      window.markflowApi.showItemInFolder(pathToOpen)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in p-4">
      <div
        className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 flex flex-col gap-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status Icon */}
        <div className="flex justify-center pt-2">
          {status === 'exporting' && (
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 animate-pulse">
              <RefreshCw size={24} className="animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 animate-scale-in">
              <CheckCircle2 size={28} />
            </div>
          )}
          {status === 'error' && (
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 animate-scale-in">
              <AlertCircle size={28} />
            </div>
          )}
        </div>

        {/* Title & Message */}
        <div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">{getTargetTitle()}</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 leading-relaxed">{message}</p>
        </div>

        {/* Detailed Result Card */}
        {status === 'success' && (githubResult || obsidianResult || folderResult) && (
          <div className="text-left bg-stone-50 dark:bg-stone-800/60 rounded-xl p-3.5 border border-stone-100 dark:border-stone-800 text-xs space-y-2">
            {githubResult && (
              <div className="flex items-start gap-2">
                <Github size={14} className="mt-0.5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-800 dark:text-stone-200">GitHub 커밋 생성 완료</div>
                  <div className="text-[11px] text-stone-500 font-mono">
                    커밋: {githubResult.commitSha?.slice(0, 7)}
                  </div>
                  {githubResult.commitUrl && (
                    <a
                      href={githubResult.commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                    >
                      GitHub에서 커밋 확인하기
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {obsidianResult && (
              <div className="flex items-start gap-2 pt-1 border-t border-stone-200/50 dark:border-stone-700/50 first:pt-0 first:border-t-0">
                <Folder size={14} className="mt-0.5 text-purple-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-800 dark:text-stone-200">Obsidian 보관함 저장 완료</div>
                  <div className="text-[11px] text-stone-500">{obsidianResult.message}</div>
                </div>
              </div>
            )}

            {folderResult && (
              <div className="flex items-start gap-2 pt-1 border-t border-stone-200/50 dark:border-stone-700/50 first:pt-0 first:border-t-0">
                {folderResult.provider === 'local' ? (
                  <FolderOpen size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                ) : (
                  <Cloud size={14} className="mt-0.5 text-sky-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-800 dark:text-stone-200">
                    {folderResult.name} 저장 완료 ({folderResult.targetPaths?.length || 1}개 파일)
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono break-all mt-0.5">
                    경로: {folderResult.targetPath}
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenSavedFolder}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-1.5 font-medium"
                  >
                    <FolderOpen size={11} />
                    저장된 폴더 열기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Details */}
        {status === 'error' && errorDetails && (
          <div className="text-left bg-rose-50/60 dark:bg-rose-950/20 rounded-xl p-3 border border-rose-100 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            <span className="font-semibold block mb-0.5">원인 안내:</span>
            {errorDetails}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-2 pt-2">
          {status === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
            >
              다시 시도
            </button>
          )}
          <button
            onClick={onClose}
            disabled={status === 'exporting'}
            className="px-5 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition-colors disabled:opacity-40"
          >
            {status === 'exporting' ? '처리 중...' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  )
}
