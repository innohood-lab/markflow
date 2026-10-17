import React, { useState } from 'react'
import { RotateCw, AlertTriangle, X, ShieldCheck } from 'lucide-react'

interface ReconvertModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (profile: 'balanced' | 'fast' | 'best_quality') => Promise<void>
  fileName: string
}

export const ReconvertModal: React.FC<ReconvertModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fileName
}) => {
  const [profile, setProfile] = useState<'balanced' | 'fast' | 'best_quality'>('balanced')
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      await onConfirm(profile)
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-floating p-6 space-y-4 animate-in fade-in zoom-in-95 duration-fast">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <RotateCw className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">문서 재변환</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-3 text-xs">
          <p className="text-foreground">
            <strong className="text-primary">{fileName}</strong> 문서를 다시 변환하시겠습니까?
          </p>

          {/* Profile Choice */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-foreground">변환 프로필 선택</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as any)}
              disabled={isProcessing}
              className="w-full bg-card border border-border/80 rounded-lg p-2 text-xs text-foreground font-medium cursor-pointer focus:outline-none focus:border-primary shadow-subtle"
            >
              <option value="balanced">균형 모드 (기본 - 전처리/이미지/후처리)</option>
              <option value="fast">빠름 모드 (기본 MarkItDown)</option>
              <option value="best_quality">최고 품질 모드 (OCR 및 도식 분석)</option>
            </select>
          </div>

          {/* Backup Notice (Rule 4 requirement) */}
          <div className="p-3 rounded-lg bg-sidebar-background border border-border/70 text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>안전한 자동 백업</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              재변환 시 직접 수정한 내용이 유실되지 않도록, 기존 문서는 <code>Library/.history/</code> 폴더에 타임스탬프와 함께 자동 스냅샷으로 백업됩니다.
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-subtle transition-all duration-fast disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>재변환 중...</span>
              </>
            ) : (
              <span>백업 후 재변환</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
