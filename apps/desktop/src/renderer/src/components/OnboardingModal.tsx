import React, { useState, useEffect } from 'react'
import {
  Folder,
  Cloud,
  Github,
  Zap,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Command,
  HardDrive,
  FileText,
  X
} from 'lucide-react'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings?: () => void
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [libraryPath, setLibraryPath] = useState('')
  const [detectedClouds, setDetectedClouds] = useState<any[]>([])
  const [loadingClouds, setLoadingClouds] = useState(false)
  const [selectedExport, setSelectedExport] = useState<'both' | 'github' | 'obsidian' | 'local'>('both')

  useEffect(() => {
    if (!isOpen) return

    const init = async () => {
      try {
        const res = await window.markflowApi.getSettings()
        setLibraryPath(res.settings?.general?.libraryDir || 'Documents/MarkFlow/Library')

        setLoadingClouds(true)
        const clouds = await window.markflowApi.detectCloudProviders()
        setDetectedClouds(clouds || [])
      } catch (err) {
        console.error('Failed to load onboarding info:', err)
      } finally {
        setLoadingClouds(false)
      }
    }

    init()
  }, [isOpen])

  if (!isOpen) return null

  const handlePickFolder = async () => {
    try {
      const res = await window.markflowApi.pickLibraryFolder()
      if (!res.canceled && res.path) {
        setLibraryPath(res.path)
        await window.markflowApi.saveSettings({
          general: {
            libraryDir: res.path
          }
        })
      }
    } catch (err) {
      console.error('Failed to pick folder:', err)
    }
  }

  const handleFinish = () => {
    localStorage.setItem('markflow_onboarding_completed', 'true')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div
        className="w-full max-w-xl bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Progress */}
        <div className="px-8 pt-7 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-blue-600'
                    : s < step
                    ? 'w-4 bg-blue-300 dark:bg-blue-800'
                    : 'w-4 bg-stone-200 dark:bg-stone-700'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleFinish}
            className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            건너뛰기
          </button>
        </div>

        {/* Step Body */}
        <div className="px-8 py-4 flex-1 min-h-[360px] flex flex-col justify-between">
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                  MarkFlow에 오신 것을 환영합니다
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  인터넷 연결이나 클라우드 서버 종속 없이, 온디바이스에서 모든 지식을 영구적인 표준 마크다운(Markdown)으로 수집하고 관리하세요.
                </p>
              </div>

              <div className="p-4 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-750 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Folder size={14} className="text-blue-500" /> 기본 마크다운 보관함 (Library)
                  </span>
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    위치 변경
                  </button>
                </div>
                <div className="px-3 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-mono text-stone-700 dark:text-stone-300 truncate">
                  {libraryPath}
                </div>
                <p className="text-[11px] text-stone-400">
                  이 디렉터리에 원문 변환 결과, 복합 자산(이미지/표), 그룹 체계 메타데이터가 안전하게 저장됩니다.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <Cloud size={24} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                  클라우드 저장소 자동 감지
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  로컬 컴퓨터에 설치된 동기화 드라이브를 자동으로 감지했습니다. 감시 폴더를 설정해 파일이 추가될 때마다 즉시 변환할 수 있습니다.
                </p>
              </div>

              <div className="space-y-2">
                {loadingClouds ? (
                  <div className="py-8 text-center text-xs text-stone-400">클라우드 폴더를 탐색 중...</div>
                ) : detectedClouds.length > 0 ? (
                  detectedClouds.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-750 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <HardDrive size={16} className="text-emerald-500" />
                        <div>
                          <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">{c.name || c.provider}</div>
                          <div className="text-[10px] text-stone-400 font-mono truncate max-w-xs">{c.path}</div>
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full font-medium">
                        감지됨 ✓
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-750 text-xs text-stone-400">
                    로컬에서 기본 클라우드 경로가 감지되지 않았습니다. 추후 설정에서 직접 원하는 폴더를 등록할 수 있습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3">
                <Zap size={24} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                  지식 저장소 연동 방식 선택
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  변환된 마크다운을 외부 저장소로 손쉽게 내보낼 수 있습니다. 선호하는 작업 방식을 선택하세요.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedExport('both')}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    selectedExport === 'both'
                      ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 ring-1 ring-purple-600'
                      : 'border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-850'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 mt-0.5">
                    <Zap size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      GitHub LLM-wiki & Obsidian 동시 연동 (권장)
                    </div>
                    <div className="text-[11px] text-stone-500 leading-snug mt-0.5">
                      깃허브 원격 위키와 로컬 옵시디언 볼트에 원자적 단일 커밋으로 양방향 동기화합니다.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedExport('local')}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    selectedExport === 'local'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-600'
                      : 'border-stone-200 dark:border-stone-750 bg-white dark:bg-stone-850'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 mt-0.5">
                    <HardDrive size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      로컬 전용 온디바이스 모드
                    </div>
                    <div className="text-[11px] text-stone-500 leading-snug mt-0.5">
                      외부 클라우드 없이 내 컴퓨터 내부 보관함에만 독립적으로 지식을 축적합니다.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                <CheckCircle size={24} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                  모든 준비가 완료되었습니다!
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  이제 복잡한 문서를 창에 드롭하기만 하면 깔끔한 마크다운으로 변환됩니다. 유용한 단축키를 기억해두세요:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-750 space-y-1">
                  <div className="text-stone-400 text-[10px] flex items-center gap-1">
                    <Command size={11} /> 커맨드 팔레트
                  </div>
                  <div className="font-semibold text-stone-800 dark:text-stone-200">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">K</kbd>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-750 space-y-1">
                  <div className="text-stone-400 text-[10px] flex items-center gap-1">
                    <FileText size={11} /> 즉시 빠른 메모
                  </div>
                  <div className="font-semibold text-stone-800 dark:text-stone-200">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">Space</kbd>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-750 space-y-1">
                  <div className="text-stone-400 text-[10px] flex items-center gap-1">
                    <FileText size={11} /> 템플릿 기반 새 문서
                  </div>
                  <div className="font-semibold text-stone-800 dark:text-stone-200">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">N</kbd>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200 dark:border-stone-750 space-y-1">
                  <div className="text-stone-400 text-[10px] flex items-center gap-1">
                    <Command size={11} /> 단축키 치트시트
                  </div>
                  <div className="font-semibold text-stone-800 dark:text-stone-200">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-900 border rounded text-[11px]">?</kbd> 키 입력
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-8 py-5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/50">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft size={14} /> 이전
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
              >
                다음 <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              >
                MarkFlow 시작하기 <Sparkles size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
