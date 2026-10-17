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
  FolderOpen
} from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'github' | 'obsidian' | 'auto'>('github')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Settings state
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

  // Obsidian state
  const [obsidianEnabled, setObsidianEnabled] = useState(true)
  const [vaultPath, setVaultPath] = useState('')
  const [inboxFolder, setInboxFolder] = useState('00_Inbox/MarkFlow')
  const [attachmentsFolder, setAttachmentsFolder] = useState('attachments/MarkFlow')
  const [vaultHint, setVaultHint] = useState('')
  const [vaultValid, setVaultValid] = useState<boolean | null>(null)
  const [vaultValidationMsg, setVaultValidationMsg] = useState('')

  // Auto export state
  const [autoExportEnabled, setAutoExportEnabled] = useState(false)
  const [autoExportTarget, setAutoExportTarget] = useState<'github' | 'obsidian' | 'both'>('both')

  useEffect(() => {
    if (!isOpen) return

    const fetchSettings = async () => {
      setLoading(true)
      try {
        const res = await window.markflowApi.getSettings()
        const s = res.settings
        setVaultHint(res.vaultHint || '')

        setGithubEnabled(s.github?.enabled ?? true)
        setOwner(s.github?.owner || 'innohood-lab')
        setRepo(s.github?.repo || 'LLM-wiki')
        setBranch(s.github?.branch || 'main')
        setBasePath(s.github?.basePath || 'inbox/markflow/')
        setMaskedPat(s.github?.maskedPat || '')
        setShowPatInput(!s.github?.maskedPat)

        setObsidianEnabled(s.obsidian?.enabled ?? true)
        setVaultPath(s.obsidian?.vaultPath || '')
        setInboxFolder(s.obsidian?.inboxFolder || '00_Inbox/MarkFlow')
        setAttachmentsFolder(s.obsidian?.attachmentsFolder || 'attachments/MarkFlow')

        setAutoExportEnabled(s.autoExport?.enabled ?? false)
        setAutoExportTarget(s.autoExport?.target || 'both')

        if (s.obsidian?.vaultPath) {
          // Verify initial vault
          // We can check validation
          setVaultValid(true)
        }
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

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.markflowApi.saveSettings({
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
        }
      })
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
        className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">내보내기 설정</h2>
            <span className="text-xs text-stone-400 font-normal">GitHub LLM-wiki & Obsidian</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 pt-3 border-b border-stone-100 dark:border-stone-800 gap-2 bg-stone-50/50 dark:bg-stone-900/50">
          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'github'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Github size={15} />
            GitHub LLM-wiki
          </button>
          <button
            onClick={() => setActiveTab('obsidian')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'obsidian'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Folder size={15} />
            Obsidian 보관함
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'auto'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-white dark:bg-stone-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Zap size={15} />
            자동 내보내기
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <span className="text-xs">설정을 불러오는 중...</span>
            </div>
          ) : activeTab === 'github' ? (
            /* Tab 1: GitHub */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">GitHub 내보내기 활성화</h3>
                  <p className="text-xs text-stone-500">
                    Git Data API를 통해 원자적 단일 커밋으로 마크다운과 이미지를 일괄 업로드합니다.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={githubEnabled}
                    onChange={(e) => setGithubEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    저장소 소유자 (Owner)
                  </label>
                  <input
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="innohood-lab"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    저장소명 (Repo)
                  </label>
                  <input
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="LLM-wiki"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    브랜치 (Branch)
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    대상 디렉터리 (Target Folder)
                  </label>
                  <input
                    type="text"
                    value={basePath}
                    onChange={(e) => setBasePath(e.target.value)}
                    placeholder="inbox/markflow/"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-blue-50/70 dark:bg-blue-950/30 p-2.5 border border-blue-100 dark:border-blue-900 text-[11px] text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>LLM-wiki 자동 동기화 보호:</strong> 맥미니에서 15분 주기로 로컬 pull/push가 실행되므로, MarkFlow는 오직 <code>inbox/markflow/</code> 내부에만 커밋을 작성합니다.
                </span>
              </div>

              {/* PAT Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPatHelp(!showPatHelp)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <HelpCircle size={12} />
                    토큰 발급 방법
                  </button>
                </div>

                {maskedPat && !showPatInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled
                      value={maskedPat}
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPatInput(true)}
                      className="px-3 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors"
                    >
                      새 토큰 입력
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPat}
                        onChange={(e) => setNewPat(e.target.value)}
                        placeholder="github_pat_... 또는 ghp_..."
                        className="w-full px-3 py-2 pr-10 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {maskedPat && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPatInput(false)
                          setNewPat('')
                        }}
                        className="text-[11px] text-stone-400 hover:text-stone-600 underline"
                      >
                        취소하고 기존 토큰 유지
                      </button>
                    )}
                  </div>
                )}
                <span className="text-[11px] text-stone-400 block mt-1">
                  Electron safeStorage(DPAPI / Keychain)로 안전하게 암호화되어 보관됩니다.
                </span>
              </div>

              {/* Help Box */}
              {showPatHelp && (
                <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 p-3.5 text-xs text-stone-700 dark:text-stone-300 space-y-2 animate-fade-in">
                  <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    <Github size={14} /> Fine-grained Personal Access Token 발급 단계
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                    <li>GitHub 프로필 &gt; <strong>Settings &gt; Developer settings &gt; Personal access tokens &gt; Fine-grained tokens</strong> 이동</li>
                    <li><strong>Generate new token</strong> 클릭 후 토큰 이름(예: <code>MarkFlow-Desktop</code>) 및 만료 기간 설정</li>
                    <li><strong>Repository access:</strong> <code>Only select repositories</code> 선택 후 <code>{repo || 'LLM-wiki'}</code> 지정</li>
                    <li><strong>Permissions &gt; Repository permissions:</strong> <code>Contents</code> 항목을 <strong>Access: Read and write</strong>로 설정 후 토큰 생성</li>
                  </ol>
                </div>
              )}

              {/* Test Button & Result */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestGitHub}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 transition-colors"
                >
                  <RefreshCw size={13} className={testing ? 'animate-spin text-blue-500' : ''} />
                  {testing ? '저장소 권한 확인 중...' : '저장소 연결 테스트'}
                </button>

                {testResult && (
                  <div
                    className={`mt-2.5 p-3 rounded-lg text-xs flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle size={15} className="mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    )}
                    <div className="leading-snug">{testResult.message}</div>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'obsidian' ? (
            /* Tab 2: Obsidian */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Obsidian 보관함 내보내기 활성화</h3>
                  <p className="text-xs text-stone-500">
                    로컬 또는 iCloud Obsidian 보관함으로 마크다운과 첨부 이미지를 복사하고 링크를 자동 보정합니다.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={obsidianEnabled}
                    onChange={(e) => setObsidianEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Vault Path Picker */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Obsidian 볼트 폴더 (Vault Directory)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={vaultPath}
                    onChange={(e) => {
                      setVaultPath(e.target.value)
                      setVaultValid(null)
                    }}
                    placeholder="예: C:\Users\User\Obsidian\MyVault 또는 iCloudDrive..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePickVault}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors shrink-0"
                  >
                    <FolderOpen size={14} />
                    폴더 찾기
                  </button>
                </div>

                {vaultValid === true && (
                  <div className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle size={12} />
                    {vaultValidationMsg || '정상적인 Obsidian 볼트가 확인되었습니다.'}
                  </div>
                )}
                {vaultValid === false && (
                  <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {vaultValidationMsg || '선택한 폴더에 .obsidian 설정 디렉터리가 없습니다.'}
                  </div>
                )}

                {vaultHint && (
                  <div className="mt-2 text-[11px] text-stone-400 bg-stone-50 dark:bg-stone-800/50 p-2 rounded border border-stone-100 dark:border-stone-800">
                    <span className="font-medium text-stone-500">iCloud 기본 경로 힌트:</span>{' '}
                    <code className="text-stone-600 dark:text-stone-300 select-all">{vaultHint}</code>
                  </div>
                )}
              </div>

              {/* Subfolder configurations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    수집함 하위 폴더 (Inbox)
                  </label>
                  <input
                    type="text"
                    value={inboxFolder}
                    onChange={(e) => setInboxFolder(e.target.value)}
                    placeholder="00_Inbox/MarkFlow"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">볼트 내 마크다운이 저장될 폴더</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    첨부 에셋 하위 폴더 (Attachments)
                  </label>
                  <input
                    type="text"
                    value={attachmentsFolder}
                    onChange={(e) => setAttachmentsFolder(e.target.value)}
                    placeholder="attachments/MarkFlow"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">문서별 이미지가 저장될 폴더</span>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 3: Auto Export */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">변환 완료 시 자동 내보내기</h3>
                  <p className="text-xs text-stone-500">
                    새 문서 변환이 끝나면 지정한 대상 지식 저장소로 백그라운드 자동 전송합니다.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoExportEnabled}
                    onChange={(e) => setAutoExportEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {autoExportEnabled && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    자동 내보내기 대상 선택
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setAutoExportTarget('github')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        autoExportTarget === 'github'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500'
                          : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center gap-1.5 mb-1">
                        <Github size={14} /> GitHub만
                      </div>
                      <div className="text-[10px] text-stone-500 leading-tight">LLM-wiki 저장소에 커밋</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutoExportTarget('obsidian')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        autoExportTarget === 'obsidian'
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-100 ring-1 ring-purple-500'
                          : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center gap-1.5 mb-1">
                        <Folder size={14} /> Obsidian만
                      </div>
                      <div className="text-[10px] text-stone-500 leading-tight">로컬/iCloud 볼트에 복사</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutoExportTarget('both')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        autoExportTarget === 'both'
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500'
                          : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center gap-1.5 mb-1">
                        <Zap size={14} /> 둘 다 (동시)
                      </div>
                      <div className="text-[10px] text-stone-500 leading-tight">GitHub 및 Obsidian 모두 반영</div>
                    </button>
                  </div>
                </div>
              )}
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
