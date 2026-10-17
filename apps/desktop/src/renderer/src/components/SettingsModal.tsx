import React, { useState, useEffect } from 'react'
import {
  X,
  Github,
  Folder,
  Zap,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Eye,
  EyeOff,
  RefreshCw,
  FolderOpen,
  Cloud,
  HardDrive,
  Plus,
  Trash2,
  Settings,
  Sliders,
  Share2,
  Info,
  Shield,
  FileText,
  Cpu,
  Key,
  FolderCheck,
  Check
} from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'conversion' | 'export' | 'cloud' | 'about'>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // 1. General Settings
  const [libraryDir, setLibraryDir] = useState('')
  const [language, setLanguage] = useState<'ko' | 'en'>('ko')
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('light')

  // 2. Conversion Settings
  const [defaultProfile, setDefaultProfile] = useState<'balanced' | 'fast' | 'best_quality'>('balanced')
  const [concurrency, setConcurrency] = useState(2)
  const [llmProvider, setLlmProvider] = useState<'none' | 'openai' | 'anthropic' | 'gemini' | 'ollama'>('none')
  const [llmModel, setLlmModel] = useState('')
  const [maskedLlmApiKey, setMaskedLlmApiKey] = useState('')
  const [newLlmApiKey, setNewLlmApiKey] = useState('')
  const [showLlmKeyInput, setShowLlmKeyInput] = useState(false)
  const [showLlmPassword, setShowLlmPassword] = useState(false)

  // 3. Export Settings (GitHub & Obsidian & Auto-Export)
  const [githubEnabled, setGithubEnabled] = useState(true)
  const [owner, setOwner] = useState('innohood-lab')
  const [repo, setRepo] = useState('LLM-wiki')
  const [branch, setBranch] = useState('main')
  const [basePath, setBasePath] = useState('inbox/markflow/')
  const [maskedPat, setMaskedPat] = useState('')
  const [newPat, setNewPat] = useState('')
  const [showPatInput, setShowPatInput] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [showPatHelp, setShowPatHelp] = useState(false)

  const [obsidianEnabled, setObsidianEnabled] = useState(true)
  const [vaultPath, setVaultPath] = useState('')
  const [inboxFolder, setInboxFolder] = useState('00_Inbox/MarkFlow')
  const [attachmentsFolder, setAttachmentsFolder] = useState('attachments/MarkFlow')
  const [vaultHint, setVaultHint] = useState('')
  const [vaultValid, setVaultValid] = useState<boolean | null>(null)
  const [vaultValidationMsg, setVaultValidationMsg] = useState('')

  const [autoExportEnabled, setAutoExportEnabled] = useState(false)
  const [autoExportTarget, setAutoExportTarget] = useState<'github' | 'obsidian' | 'both'>('both')

  // 4. Cloud Destinations & Watch Folders
  const [cloudDestinations, setCloudDestinations] = useState<any[]>([])
  const [watchFolders, setWatchFolders] = useState<any[]>([])
  const [detectedCloudAccounts, setDetectedCloudAccounts] = useState<any[]>([])

  const [newDestName, setNewDestName] = useState('')
  const [newDestPath, setNewDestPath] = useState('')
  const [newDestProvider, setNewDestProvider] = useState('gdrive')
  const [newDestRule, setNewDestRule] = useState<'flat' | 'date'>('flat')
  const [newDestAutoSave, setNewDestAutoSave] = useState(false)

  // 5. About & Engine State
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const [restartingEngine, setRestartingEngine] = useState(false)
  const [logFolderOpening, setLogFolderOpening] = useState(false)
  const [clearingTokens, setClearingTokens] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const fetchSettings = async () => {
      setLoading(true)
      try {
        const res = await window.markflowApi.getSettings()
        const s = res.settings
        setVaultHint(res.vaultHint || '')

        // General
        setLibraryDir(s.general?.libraryDir || '')
        setLanguage(s.general?.language || 'ko')
        setTheme(s.general?.theme || 'light')

        // Conversion
        setDefaultProfile(s.conversion?.defaultProfile || 'balanced')
        setConcurrency(s.conversion?.concurrency || 2)
        setLlmProvider(s.conversion?.llmProvider || 'none')
        setLlmModel(s.conversion?.llmModel || '')
        setMaskedLlmApiKey(s.conversion?.maskedLlmApiKey || '')
        setShowLlmKeyInput(!s.conversion?.maskedLlmApiKey)

        // GitHub
        setGithubEnabled(s.github?.enabled ?? true)
        setOwner(s.github?.owner || 'innohood-lab')
        setRepo(s.github?.repo || 'LLM-wiki')
        setBranch(s.github?.branch || 'main')
        setBasePath(s.github?.basePath || 'inbox/markflow/')
        setMaskedPat(s.github?.maskedPat || '')
        setShowPatInput(!s.github?.maskedPat)

        // Obsidian
        setObsidianEnabled(s.obsidian?.enabled ?? true)
        setVaultPath(s.obsidian?.vaultPath || '')
        setInboxFolder(s.obsidian?.inboxFolder || '00_Inbox/MarkFlow')
        setAttachmentsFolder(s.obsidian?.attachmentsFolder || 'attachments/MarkFlow')

        // Cloud & Watch
        setCloudDestinations(s.cloudDestinations || [])
        setWatchFolders(s.watchFolders || [])

        // Auto Export
        setAutoExportEnabled(s.autoExport?.enabled ?? false)
        setAutoExportTarget(s.autoExport?.target || 'both')

        if (s.obsidian?.vaultPath) {
          setVaultValid(true)
        }

        // Fetch detected cloud sync folders
        const clouds = await window.markflowApi.detectCloudProviders()
        setDetectedCloudAccounts(clouds || [])

        // Fetch engine status for About tab
        const status = await window.markflowApi.getEngineStatus()
        setEngineStatus(status)
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
    setTestResult(null)
    setSaveSuccess(false)
  }, [isOpen])

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handlePickLibraryFolder = async () => {
    try {
      const res = await window.markflowApi.pickLibraryFolder()
      if (!res.canceled && res.path) {
        setLibraryDir(res.path)
      }
    } catch (err) {
      console.error('Failed to pick library folder:', err)
    }
  }

  const handleTestGitHub = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await window.markflowApi.testGitHubConnection({
        owner,
        repo,
        branch,
        pat: newPat.trim() || undefined
      })
      setTestResult(res)
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || '네트워크 오류가 발생했습니다.'
      })
    } finally {
      setTesting(false)
    }
  }

  const handlePickVault = async () => {
    try {
      const res = await window.markflowApi.pickObsidianVault()
      if (!res.canceled && res.path) {
        setVaultPath(res.path)
        setVaultValid(res.validation?.valid ?? false)
        setVaultValidationMsg(res.validation?.message ?? '')
      }
    } catch (err) {
      console.error('Failed to pick vault:', err)
    }
  }

  const handlePickDestFolder = async () => {
    try {
      const res = await window.markflowApi.pickCloudFolder()
      if (!res.canceled && res.path) {
        setNewDestPath(res.path)
        if (!newDestName) {
          setNewDestName(res.path.split(/[\\/]/).pop() || '클라우드 저장소')
        }
      }
    } catch (err) {
      console.error('Failed to pick destination folder:', err)
    }
  }

  const handleAddDestination = () => {
    if (!newDestPath) return
    const id = `dest-${Date.now()}`
    const newDest = {
      id,
      provider: newDestProvider,
      name: newDestName || '클라우드 저장 대상',
      targetPath: newDestPath,
      folderRule: newDestRule,
      autoSave: newDestAutoSave
    }
    setCloudDestinations((prev) => [...prev, newDest])
    setNewDestName('')
    setNewDestPath('')
  }

  const handleRemoveDestination = (id: string) => {
    setCloudDestinations((prev) => prev.filter((d) => d.id !== id))
  }

  const handlePickWatchFolder = async () => {
    try {
      const res = await window.markflowApi.pickCloudFolder()
      if (!res.canceled && res.path) {
        const id = `watch-${Date.now()}`
        const name = res.path.split(/[\\/]/).pop() || '감시 폴더'
        setWatchFolders((prev) => [...prev, { id, name, path: res.path, enabled: true }])
      }
    } catch (err) {
      console.error('Failed to pick watch folder:', err)
    }
  }

  const handleToggleWatchFolder = (id: string) => {
    setWatchFolders((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    )
  }

  const handleRemoveWatchFolder = (id: string) => {
    setWatchFolders((prev) => prev.filter((w) => w.id !== id))
  }

  const handleRestartEngine = async () => {
    setRestartingEngine(true)
    try {
      const status = await window.markflowApi.restartEngine()
      setEngineStatus(status)
    } catch (err) {
      console.error('Failed to restart engine:', err)
    } finally {
      setRestartingEngine(false)
    }
  }

  const handleOpenLogFolder = async () => {
    setLogFolderOpening(true)
    try {
      await window.markflowApi.openLogFolder()
    } catch (err) {
      console.error('Failed to open log folder:', err)
    } finally {
      setLogFolderOpening(false)
    }
  }

  const handleClearTokens = async () => {
    if (!window.confirm('정말로 저장된 GitHub PAT 및 LLM API 키를 완전히 삭제하시겠습니까?')) {
      return
    }
    setClearingTokens(true)
    try {
      await window.markflowApi.saveSettings({
        githubPat: '',
        llmApiKey: ''
      })
      setMaskedPat('')
      setNewPat('')
      setShowPatInput(true)
      setMaskedLlmApiKey('')
      setNewLlmApiKey('')
      setShowLlmKeyInput(true)
      alert('보안 토큰이 모두 안전하게 삭제되었습니다.')
    } catch (err) {
      console.error('Failed to clear tokens:', err)
    } finally {
      setClearingTokens(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.markflowApi.saveSettings({
        general: {
          libraryDir,
          language,
          theme
        },
        conversion: {
          defaultProfile,
          concurrency,
          llmProvider,
          llmModel
        },
        llmApiKey: newLlmApiKey.trim() ? newLlmApiKey.trim() : undefined,
        github: {
          enabled: githubEnabled,
          owner,
          repo,
          branch,
          basePath
        },
        githubPat: newPat.trim() ? newPat.trim() : undefined,
        obsidian: {
          enabled: obsidianEnabled,
          vaultPath,
          inboxFolder,
          attachmentsFolder
        },
        autoExport: {
          enabled: autoExportEnabled,
          target: autoExportTarget
        },
        cloudDestinations,
        watchFolders
      })

      // Reload watch folder service with updated paths
      await window.markflowApi.reloadWatchFolders?.()

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onClose()
      }, 700)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in p-4">
      <div
        className="w-full max-w-3xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">환경 설정</h2>
            <span className="text-xs text-stone-400 font-normal">보관함 · 변환 · 내보내기 · 클라우드 · 진단</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 5-Tab Navigation */}
        <div className="flex px-6 pt-3 border-b border-stone-100 dark:border-stone-800 gap-2 bg-stone-50/50 dark:bg-stone-900/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors shrink-0 ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Settings size={14} />
            일반
          </button>
          <button
            onClick={() => setActiveTab('conversion')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors shrink-0 ${
              activeTab === 'conversion'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Sliders size={14} />
            변환 & AI
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors shrink-0 ${
              activeTab === 'export'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Share2 size={14} />
            내보내기
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors shrink-0 ${
              activeTab === 'cloud'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Cloud size={14} />
            클라우드 & 감시
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors shrink-0 ${
              activeTab === 'about'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Info size={14} />
            정보 & 진단
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-stone-400 gap-2">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <span className="text-xs">환경 설정을 불러오는 중...</span>
            </div>
          ) : activeTab === 'general' ? (
            /* TAB 1: GENERAL */
            <div className="space-y-6 animate-fade-in">
              {/* Library Path */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-blue-600" />
                    <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                      기본 마크다운 보관함 (Library)
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-stone-500 leading-relaxed">
                  모든 변환 문서와 복합 자산(이미지, 첨부파일)이 온디바이스 로컬 디렉터리에 표준 마크다운 형식으로 영구 보관됩니다.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={libraryDir || '기본 경로: Documents/MarkFlow/Library'}
                    readOnly
                    className="flex-1 px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-mono select-all"
                  />
                  <button
                    type="button"
                    onClick={handlePickLibraryFolder}
                    className="px-3 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Folder size={14} /> 폴더 변경
                  </button>
                </div>
              </div>

              {/* Language & Appearance */}
              <div className="grid grid-cols-2 gap-4">
                {/* Language */}
                <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-2.5">
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">인터페이스 언어</h3>
                  <p className="text-xs text-stone-500">기본 표시 언어를 선택합니다.</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLanguage('ko')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        language === 'ko'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      한국어 (KO)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        language === 'en'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      English (EN)
                    </button>
                  </div>
                </div>

                {/* Theme */}
                <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-2.5">
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">화면 테마</h3>
                  <p className="text-xs text-stone-500">앱의 외형 스타일을 설정합니다.</p>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`px-2 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        theme === 'light'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      라이트
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`px-2 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        theme === 'dark'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      다크
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={`px-2 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        theme === 'system'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      시스템
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'conversion' ? (
            /* TAB 2: CONVERSION & AI */
            <div className="space-y-6 animate-fade-in">
              {/* Profile Selection */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">기본 변환 프로필</h3>
                  <p className="text-xs text-stone-500">
                    파일을 드롭하거나 변환할 때 기본 적용될 MarkItDown 파이프라인 품질 수준을 지정합니다.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDefaultProfile('balanced')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      defaultProfile === 'balanced'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-600'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-850 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between mb-1">
                      <span>Balanced (균형)</span>
                      {defaultProfile === 'balanced' && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <div className="text-[11px] text-stone-500 leading-snug">
                      서식과 속도의 완벽한 균형 (일반 문서 기본 권장)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDefaultProfile('fast')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      defaultProfile === 'fast'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-600'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-850 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between mb-1">
                      <span>Fast (고속)</span>
                      {defaultProfile === 'fast' && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <div className="text-[11px] text-stone-500 leading-snug">
                      이미지 최소화 및 대용량 문서 고속 텍스트 추출
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDefaultProfile('best_quality')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      defaultProfile === 'best_quality'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-600'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-850 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between mb-1">
                      <span>Best Quality (최고 품질)</span>
                      {defaultProfile === 'best_quality' && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <div className="text-[11px] text-stone-500 leading-snug">
                      복잡한 표, 수식, 고해상도 자산 정밀 추출
                    </div>
                  </button>
                </div>
              </div>

              {/* Concurrency */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">동시 변환 작업 수 (Concurrency)</h3>
                    <p className="text-xs text-stone-500">배치 변환 시 CPU 부하를 고려해 병렬 작업 수를 조절합니다.</p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
                    {concurrency}개 작업
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setConcurrency(num)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        concurrency === num
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* LLM & AI Configuration */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-indigo-600" />
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                    외부 LLM 보강 연동 (선택 사항)
                  </h3>
                </div>
                <p className="text-xs text-stone-500">
                  기본 유사도 분석 및 태그 제안은 온디바이스 엔진에서 무료로 동작합니다. 더 정교한 복합 문서 요약이나 OCR 보강이 필요한 경우에만 API 키를 등록하세요.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      LLM 공급자 (Provider)
                    </label>
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200"
                    >
                      <option value="none">사용 안 함 (온디바이스 전용)</option>
                      <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                      <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                      <option value="gemini">Google Gemini (Gemini 1.5 Pro/Flash)</option>
                      <option value="ollama">Ollama (로컬 프라이빗 모델)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      모델 식별자 (Model Name)
                    </label>
                    <input
                      type="text"
                      disabled={llmProvider === 'none'}
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      placeholder={llmProvider === 'ollama' ? 'llama3' : 'gpt-4o'}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                {llmProvider !== 'none' && llmProvider !== 'ollama' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                      API 키 (안전한 Electron safeStorage 분리 보관)
                    </label>
                    {maskedLlmApiKey && !showLlmKeyInput ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 text-xs bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg font-mono text-stone-600 dark:text-stone-400">
                          {maskedLlmApiKey}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLlmKeyInput(true)}
                          className="px-3 py-2 text-xs font-medium text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                        >
                          키 변경
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type={showLlmPassword ? 'text' : 'password'}
                          value={newLlmApiKey}
                          onChange={(e) => setNewLlmApiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 pr-10 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLlmPassword(!showLlmPassword)}
                          className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                        >
                          {showLlmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'export' ? (
            /* TAB 3: EXPORT (GITHUB & OBSIDIAN & AUTO-EXPORT) */
            <div className="space-y-6 animate-fade-in">
              {/* GitHub Card */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Github size={16} className="text-stone-800 dark:text-stone-200" />
                    <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                      GitHub LLM-wiki 내보내기
                    </h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={githubEnabled}
                      onChange={(e) => setGithubEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      GitHub 소유자 / 조직
                    </label>
                    <input
                      type="text"
                      disabled={!githubEnabled}
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      저장소 (Repository)
                    </label>
                    <input
                      type="text"
                      disabled={!githubEnabled}
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      대상 브랜치 (Branch)
                    </label>
                    <input
                      type="text"
                      disabled={!githubEnabled}
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      저장소 내 기본 경로
                    </label>
                    <input
                      type="text"
                      disabled={!githubEnabled}
                      value={basePath}
                      onChange={(e) => setBasePath(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* PAT Section */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                      Personal Access Token (PAT)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPatHelp(!showPatHelp)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <HelpCircle size={12} /> 토큰 발급 가이드
                    </button>
                  </div>

                  {showPatHelp && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-800 dark:text-blue-300 space-y-1">
                      <p className="font-semibold">GitHub 토큰 필요 권한 (Fine-grained 또는 Classic):</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        <li>Classic Token: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">repo</code> 권한 전체</li>
                        <li>Fine-grained: Repository permissions &gt; <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">Contents: Read and write</code></li>
                      </ul>
                    </div>
                  )}

                  {maskedPat && !showPatInput ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 text-xs bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg font-mono text-stone-600 dark:text-stone-400">
                        {maskedPat}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPatInput(true)}
                        className="px-3 py-2 text-xs font-medium text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                      >
                        토큰 변경
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        disabled={!githubEnabled}
                        value={newPat}
                        onChange={(e) => setNewPat(e.target.value)}
                        placeholder="ghp_..."
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 pr-10 font-mono disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  )}

                  {/* GitHub Test Button */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={!githubEnabled || testing || (!newPat && !maskedPat)}
                      onClick={handleTestGitHub}
                      className="px-3 py-1.5 text-xs font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-lg border border-stone-300 dark:border-stone-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {testing ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                      {testing ? '연결 확인 중...' : '저장소 연결 테스트'}
                    </button>

                    {testResult && (
                      <span
                        className={`text-xs flex items-center gap-1 ${
                          testResult.success ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Obsidian Card */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder size={16} className="text-purple-600" />
                    <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                      Obsidian 보관함 동기화
                    </h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={obsidianEnabled}
                      onChange={(e) => setObsidianEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Obsidian 볼트 경로 (.obsidian 포함 폴더)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!obsidianEnabled}
                      value={vaultPath}
                      onChange={(e) => setVaultPath(e.target.value)}
                      placeholder={vaultHint || 'C:\\Users\\...\\Obsidian\\Vault'}
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 font-mono disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={!obsidianEnabled}
                      onClick={handlePickVault}
                      className="px-3 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      <FolderOpen size={14} /> 볼트 선택
                    </button>
                  </div>
                  {vaultValid !== null && (
                    <div
                      className={`text-xs flex items-center gap-1 pt-1 ${
                        vaultValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {vaultValid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                      {vaultValidationMsg || (vaultValid ? '유효한 Obsidian 볼트입니다.' : '볼트 검증 필요')}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      인박스 하위 폴더
                    </label>
                    <input
                      type="text"
                      disabled={!obsidianEnabled}
                      value={inboxFolder}
                      onChange={(e) => setInboxFolder(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      첨부파일 하위 폴더
                    </label>
                    <input
                      type="text"
                      disabled={!obsidianEnabled}
                      value={attachmentsFolder}
                      onChange={(e) => setAttachmentsFolder(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-200 font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Auto Export Card */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                        자동 내보내기 (Auto-Export)
                      </h3>
                      <p className="text-xs text-stone-500">
                        변환 완료 즉시 별도 승인 없이 외부 저장소에 마크다운을 자동 반영합니다.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoExportEnabled}
                      onChange={(e) => setAutoExportEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {autoExportEnabled && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAutoExportTarget('github')}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        autoExportTarget === 'github'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Github size={14} className="mx-auto mb-1" />
                      <div className="text-xs">GitHub만</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoExportTarget('obsidian')}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        autoExportTarget === 'obsidian'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Folder size={14} className="mx-auto mb-1" />
                      <div className="text-xs">Obsidian만</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoExportTarget('both')}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        autoExportTarget === 'both'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Zap size={14} className="mx-auto mb-1" />
                      <div className="text-xs">둘 다 동시</div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'cloud' ? (
            /* TAB 4: CLOUD & WATCH FOLDERS */
            <div className="space-y-6 animate-fade-in">
              {/* Detected Providers */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-3">
                <div className="flex items-center gap-2">
                  <Cloud size={16} className="text-emerald-600" />
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                    자동 감지된 클라우드 동기화 폴더
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {detectedCloudAccounts.length > 0 ? (
                    detectedCloudAccounts.map((acc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg flex items-center gap-2.5"
                      >
                        <HardDrive size={15} className="text-stone-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                            {acc.name || acc.provider}
                          </div>
                          <div className="text-[10px] text-stone-400 truncate">{acc.path}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-xs text-stone-400 py-2">
                      감지된 클라우드 동기화 드라이브가 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* Watch Folders */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderCheck size={16} className="text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                        자동 감시 폴더 (Watch Folders)
                      </h3>
                      <p className="text-xs text-stone-500">
                        지정한 폴더에 신규 문서가 추가되면 5초 주기로 자동 감지하여 인박스로 가져옵니다.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePickWatchFolder}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus size={13} /> 폴더 추가
                  </button>
                </div>

                <div className="space-y-2">
                  {watchFolders.map((wf) => (
                    <div
                      key={wf.id}
                      className="p-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
                          {wf.name}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono truncate">{wf.path}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wf.enabled}
                            onChange={() => handleToggleWatchFolder(wf.id)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveWatchFolder(wf.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security & Token Revocation */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <Shield size={15} className="text-rose-500" />
                    보안 및 자격 증명 초기화
                  </h3>
                  <p className="text-xs text-stone-500">
                    로컬 시스템의 안전 저장소(safeStorage)에 보관된 GitHub PAT 및 LLM API 키를 즉시 완전 삭제합니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={clearingTokens}
                  onClick={handleClearTokens}
                  className="px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-100 transition-colors shrink-0"
                >
                  {clearingTokens ? '삭제 중...' : '토큰 완전 삭제'}
                </button>
              </div>
            </div>
          ) : (
            /* TAB 5: ABOUT & DIAGNOSTICS */
            <div className="space-y-6 animate-fade-in">
              {/* App Overview */}
              <div className="p-5 bg-gradient-to-br from-stone-50 to-stone-100/60 dark:from-stone-850 dark:to-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                      MarkFlow Desktop
                    </h3>
                    <p className="text-xs text-stone-500">
                      온디바이스 마크다운 지식 보관소 (PKM Desktop Platform)
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-900">
                    v0.1.0 (PKM Edition)
                  </span>
                </div>
              </div>

              {/* Engine Status */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                      Python MarkItDown 변환 사이드카
                    </h3>
                  </div>
                  <button
                    type="button"
                    disabled={restartingEngine}
                    onClick={handleRestartEngine}
                    className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-100 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} className={restartingEngine ? 'animate-spin' : ''} />
                    {restartingEngine ? '재시작 중...' : '엔진 재시작'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700">
                    <span className="text-stone-400 block text-[10px]">엔진 상태</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          engineStatus?.state === 'ready'
                            ? 'bg-emerald-500'
                            : engineStatus?.state === 'starting'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      {engineStatus?.state || 'stopped'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700">
                    <span className="text-stone-400 block text-[10px]">MarkItDown 버전</span>
                    <span className="font-semibold font-mono text-stone-800 dark:text-stone-200 mt-0.5 block">
                      {engineStatus?.markitdownVersion || '0.1.4'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700">
                    <span className="text-stone-400 block text-[10px]">로컬 격리 포트</span>
                    <span className="font-semibold font-mono text-stone-800 dark:text-stone-200 mt-0.5 block">
                      127.0.0.1:{engineStatus?.port || '동적'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logs & Diagnostics */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <FileText size={15} className="text-blue-500" />
                    진단 로그 및 장애 보고
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    날짜별 로그 파일이 7일간 보관되며, 모든 개인 액세스 토큰은 자동 마스킹 처리됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={logFolderOpening}
                  onClick={handleOpenLogFolder}
                  className="px-3.5 py-2 text-xs font-medium text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-100 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <FolderOpen size={14} />
                  {logFolderOpening ? '여는 중...' : '로그 폴더 열기'}
                </button>
              </div>

              {/* License & GitHub Link */}
              <div className="pt-2 text-center text-xs text-stone-400 space-y-1">
                <div>MarkFlow Open Source Project · Released under the MIT License</div>
                <div className="text-[11px] text-stone-500">
                  <a
                    href="https://github.com/innohood-lab/markflow"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline text-blue-500"
                  >
                    https://github.com/innohood-lab/markflow
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div className="text-xs text-stone-400">
            {saveSuccess && <span className="text-emerald-600 font-medium">설정이 저장되었습니다 ✓</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              닫기
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : null}
              {saving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
