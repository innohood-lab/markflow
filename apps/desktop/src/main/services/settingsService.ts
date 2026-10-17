import { safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Octokit } from '@octokit/rest'
import { getSetting, setSetting } from '../db'

export interface MarkFlowSettings {
  github: {
    enabled: boolean
    owner: string
    repo: string
    branch: string
    basePath: string
    pat?: string // Decrypted, only in main process
    maskedPat?: string // Safe masked string for renderer display
  }
  obsidian: {
    enabled: boolean
    vaultPath: string
    inboxFolder: string
    attachmentsFolder: string
  }
  autoExport: {
    enabled: boolean
    target: 'github' | 'obsidian' | 'both'
  }
}

export const DEFAULT_SETTINGS: MarkFlowSettings = {
  github: {
    enabled: true,
    owner: 'innohood-lab',
    repo: 'LLM-wiki',
    branch: 'main',
    basePath: 'inbox/markflow/',
    pat: '',
    maskedPat: ''
  },
  obsidian: {
    enabled: true,
    vaultPath: '',
    inboxFolder: '00_Inbox/MarkFlow',
    attachmentsFolder: 'attachments/MarkFlow'
  },
  autoExport: {
    enabled: false,
    target: 'both'
  }
}

/**
 * Encrypt a secret string using Electron safeStorage (DPAPI / Keychain) with safe fallback.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return ''
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(plainText)
      return 'enc:' + buffer.toString('base64')
    }
  } catch (err) {
    console.warn('[safeStorage] Encryption failed, falling back to encoded storage:', err)
  }
  return 'b64:' + Buffer.from(plainText, 'utf-8').toString('base64')
}

/**
 * Decrypt a secret string from safeStorage or fallback.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return ''
  try {
    if (cipherText.startsWith('enc:')) {
      const buffer = Buffer.from(cipherText.slice(4), 'base64')
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buffer)
      }
    } else if (cipherText.startsWith('b64:')) {
      return Buffer.from(cipherText.slice(4), 'base64').toString('utf-8')
    }
  } catch (err) {
    console.error('[safeStorage] Decryption failed:', err)
  }
  return ''
}

/**
 * Mask PAT for safe UI presentation (e.g. "ghp_••••••••••••cdef")
 */
export function maskPat(pat: string): string {
  if (!pat) return ''
  if (pat.length <= 8) return pat.slice(0, 4) + '••••'
  return pat.slice(0, 4) + '•'.repeat(Math.min(12, pat.length - 8)) + pat.slice(-4)
}

/**
 * Returns suggested default Obsidian vault path hint based on the OS.
 */
export function getDefaultVaultHint(): string {
  const home = os.homedir()
  if (process.platform === 'darwin') {
    return path.join(home, 'Library/Mobile Documents/iCloud~md~obsidian/Documents/<볼트명>')
  }
  return path.join(home, 'iCloudDrive', 'iCloud~md~obsidian', '<볼트명>')
}

/**
 * Load settings from SQLite DB, decrypting secrets.
 */
export function loadSettings(includeSecret = false): MarkFlowSettings {
  const raw = getSetting('markflow_settings')
  let parsed: any = {}
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      console.error('[Settings] Failed to parse settings JSON:', e)
    }
  }

  const encryptedPat = parsed.github?.encryptedPat || ''
  const decryptedPat = decryptSecret(encryptedPat)

  const settings: MarkFlowSettings = {
    github: {
      enabled: parsed.github?.enabled ?? DEFAULT_SETTINGS.github.enabled,
      owner: (parsed.github?.owner ?? DEFAULT_SETTINGS.github.owner).trim(),
      repo: (parsed.github?.repo ?? DEFAULT_SETTINGS.github.repo).trim(),
      branch: (parsed.github?.branch ?? DEFAULT_SETTINGS.github.branch).trim(),
      basePath: (parsed.github?.basePath ?? DEFAULT_SETTINGS.github.basePath).trim(),
      pat: includeSecret ? decryptedPat : undefined,
      maskedPat: maskPat(decryptedPat)
    },
    obsidian: {
      enabled: parsed.obsidian?.enabled ?? DEFAULT_SETTINGS.obsidian.enabled,
      vaultPath: (parsed.obsidian?.vaultPath ?? DEFAULT_SETTINGS.obsidian.vaultPath).trim(),
      inboxFolder: (parsed.obsidian?.inboxFolder ?? DEFAULT_SETTINGS.obsidian.inboxFolder).trim(),
      attachmentsFolder: (parsed.obsidian?.attachmentsFolder ?? DEFAULT_SETTINGS.obsidian.attachmentsFolder).trim()
    },
    autoExport: {
      enabled: parsed.autoExport?.enabled ?? DEFAULT_SETTINGS.autoExport.enabled,
      target: parsed.autoExport?.target ?? DEFAULT_SETTINGS.autoExport.target
    }
  }

  return settings
}

/**
 * Save settings to SQLite DB, encrypting sensitive fields.
 */
export function saveSettings(updates: Partial<MarkFlowSettings> & { githubPat?: string }): MarkFlowSettings {
  const current = loadSettings(true)

  let patToSave = current.github.pat || ''
  if (updates.githubPat !== undefined) {
    // If user provided a new PAT (not masked)
    patToSave = updates.githubPat.trim()
  }

  const merged = {
    github: {
      enabled: updates.github?.enabled ?? current.github.enabled,
      owner: (updates.github?.owner ?? current.github.owner).trim(),
      repo: (updates.github?.repo ?? current.github.repo).trim(),
      branch: (updates.github?.branch ?? current.github.branch).trim(),
      basePath: (updates.github?.basePath ?? current.github.basePath).trim(),
      encryptedPat: encryptSecret(patToSave)
    },
    obsidian: {
      enabled: updates.obsidian?.enabled ?? current.obsidian.enabled,
      vaultPath: (updates.obsidian?.vaultPath ?? current.obsidian.vaultPath).trim(),
      inboxFolder: (updates.obsidian?.inboxFolder ?? current.obsidian.inboxFolder).trim(),
      attachmentsFolder: (updates.obsidian?.attachmentsFolder ?? current.obsidian.attachmentsFolder).trim()
    },
    autoExport: {
      enabled: updates.autoExport?.enabled ?? current.autoExport.enabled,
      target: updates.autoExport?.target ?? current.autoExport.target
    }
  }

  setSetting('markflow_settings', JSON.stringify(merged))

  return loadSettings(false)
}

/**
 * Validate an Obsidian vault directory by checking for .obsidian.
 */
export function validateObsidianVault(vaultPath: string): { valid: boolean; message: string } {
  if (!vaultPath) {
    return { valid: false, message: 'Obsidian 볼트 경로가 설정되지 않았습니다.' }
  }
  if (!fs.existsSync(vaultPath)) {
    return { valid: false, message: '지정한 볼트 경로가 존재하지 않습니다.' }
  }
  const obsidianDir = path.join(vaultPath, '.obsidian')
  if (!fs.existsSync(obsidianDir)) {
    return {
      valid: false,
      message: '선택한 폴더에 .obsidian 설정 디렉터리가 없습니다. 올바른 Obsidian 볼트 폴더인지 확인해주세요.'
    }
  }
  return { valid: true, message: '유효한 Obsidian 볼트입니다.' }
}

/**
 * Test GitHub repository access and push permissions using Octokit.
 */
export async function testGitHubConnection(
  owner: string,
  repo: string,
  branch: string,
  pat?: string
): Promise<{ success: boolean; message: string }> {
  const token = pat || loadSettings(true).github.pat
  if (!token) {
    return { success: false, message: 'GitHub PAT 토큰이 설정되지 않았습니다.' }
  }
  if (!owner || !repo) {
    return { success: false, message: '저장소 소유자(owner) 및 저장소 이름(repo)을 입력해주세요.' }
  }

  try {
    const octokit = new Octokit({ auth: token })
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo })

    try {
      await octokit.rest.repos.getBranch({ owner, repo, branch: branch || 'main' })
    } catch {
      return {
        success: false,
        message: `저장소 '${owner}/${repo}'는 연결되었으나 브랜치 '${branch}'를 찾을 수 없습니다.`
      }
    }

    const permissions = repoData.permissions
    if (permissions && !permissions.push) {
      return {
        success: false,
        message: `저장소 '${owner}/${repo}'에 접근할 수 있으나 쓰기(push) 권한이 없습니다. PAT의 Contents: Read and write 권한을 확인해주세요.`
      }
    }

    return {
      success: true,
      message: `연결 성공! 저장소: ${repoData.full_name} (${repoData.private ? '비공개' : '공개'})`
    }
  } catch (err: any) {
    if (err.status === 401) {
      return {
        success: false,
        message: '토큰 인증에 실패했습니다 (401 Unauthorized). PAT 유효 기간 및 권한을 확인해주세요.'
      }
    } else if (err.status === 404) {
      return {
        success: false,
        message: `저장소 '${owner}/${repo}'를 찾을 수 없습니다 (404 Not Found). 저장소명 또는 비공개 저장소 접근 권한을 확인해주세요.`
      }
    } else if (err.status === 403) {
      return {
        success: false,
        message: '접근이 거부되었습니다 (403 Forbidden). API 호출 한도(Rate limit) 또는 토큰 권한을 확인해주세요.'
      }
    }
    return { success: false, message: `연결 실패: ${err.message || '알 수 없는 네트워크 오류'}` }
  }
}
