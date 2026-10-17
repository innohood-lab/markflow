import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { maskSensitiveData, LoggerService } from '../src/main/services/loggerService'
import {
  encryptSecret,
  decryptSecret,
  maskPat,
  loadSettings,
  saveSettings
} from '../src/main/services/settingsService'

// Mock db for settingsService
let mockSettingsStore: string | null = null

vi.mock('../src/main/db', () => ({
  getSetting: vi.fn().mockImplementation((key: string) => {
    if (key === 'markflow_settings') return mockSettingsStore
    return null
  }),
  setSetting: vi.fn().mockImplementation((key: string, value: string) => {
    if (key === 'markflow_settings') mockSettingsStore = value
  }),
  ConversionRecord: {},
  updateConversion: vi.fn(),
  logExport: vi.fn()
}))

describe('Phase 9: Security, Logging, and Settings', () => {
  describe('maskSensitiveData', () => {
    it('should mask classic GitHub Personal Access Tokens', () => {
      const raw = 'Error uploading to GitHub with token ghp_1234567890abcdef1234567890abcdef'
      const masked = maskSensitiveData(raw)
      expect(masked).toBe('Error uploading to GitHub with token ghp_****')
      expect(masked).not.toContain('ghp_1234567890abcdef1234567890abcdef')
    })

    it('should mask fine-grained GitHub PATs', () => {
      const raw = 'Auth token: github_pat_11ABCD1234567890_abcdefghij'
      const masked = maskSensitiveData(raw)
      expect(masked).toBe('Auth token: github_pat_****')
    })

    it('should mask OpenAI and generic sk- API keys', () => {
      const raw = 'Using OpenAI key sk-proj-1234567890abcdef123456789 for conversion'
      const masked = maskSensitiveData(raw)
      expect(masked).toBe('Using OpenAI key sk-**** for conversion')
      expect(masked).not.toContain('1234567890abcdef')
    })

    it('should mask Google Gemini API keys', () => {
      const raw = 'Gemini key: AIzaSyB1234567890abcdef1234567890abc is initialized'
      const masked = maskSensitiveData(raw)
      expect(masked).toBe('Gemini key: AIzaSy**** is initialized')
    })

    it('should mask HTTP Bearer authorization headers', () => {
      const raw = 'Request headers: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test'
      const masked = maskSensitiveData(raw)
      expect(masked).toBe('Request headers: Authorization: Bearer ****')
    })

    it('should mask JSON key-value secrets', () => {
      const raw = 'Config: {"apiKey": "superSecretKey123", "normal": "public"}'
      const masked = maskSensitiveData(raw)
      expect(masked).toContain('"apiKey": "****"')
      expect(masked).toContain('"normal": "public"')
    })
  })

  describe('LoggerService', () => {
    let tempLogDir: string
    let logger: LoggerService

    beforeEach(() => {
      tempLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-log-test-'))
      logger = new LoggerService(tempLogDir)
    })

    afterEach(() => {
      if (fs.existsSync(tempLogDir)) {
        fs.rmSync(tempLogDir, { recursive: true, force: true })
      }
    })

    it('should write formatted and masked logs to today log file', () => {
      logger.info('MarkFlow engine started successfully')
      logger.warn('Token provided: ghp_1234567890abcdef1234567890abcdef')

      const files = fs.readdirSync(tempLogDir)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/^markflow-\d{4}-\d{2}-\d{2}\.log$/)

      const content = fs.readFileSync(path.join(tempLogDir, files[0]), 'utf-8')
      expect(content).toContain('[INFO] MarkFlow engine started successfully')
      expect(content).toContain('[WARN] Token provided: ghp_****')
      expect(content).not.toContain('ghp_1234567890abcdef1234567890abcdef')
    })

    it('should delete log files older than retention period', () => {
      // Create today's log
      logger.info('Today log entry')

      // Create an old log file (e.g. 15 days ago)
      const oldLogFile = path.join(tempLogDir, 'markflow-2026-01-01.log')
      fs.writeFileSync(oldLogFile, '[2026-01-01 10:00:00.000] [INFO] Ancient log\n', 'utf-8')

      // Set mtime to 15 days ago
      const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000
      fs.utimesSync(oldLogFile, new Date(fifteenDaysAgo), new Date(fifteenDaysAgo))

      const deleted = logger.cleanOldLogs(7)
      expect(deleted).toBe(1)

      const remainingFiles = fs.readdirSync(tempLogDir)
      expect(remainingFiles).not.toContain('markflow-2026-01-01.log')
      expect(remainingFiles.length).toBe(1)
    })
  })

  describe('SettingsService & Security', () => {
    beforeEach(() => {
      mockSettingsStore = null
    })

    it('should encrypt and decrypt secrets safely', () => {
      const secret = 'ghp_secretTokenForTest1234567890'
      const encrypted = encryptSecret(secret)
      expect(encrypted).not.toBe(secret)
      expect(encrypted.startsWith('enc:') || encrypted.startsWith('b64:')).toBe(true)

      const decrypted = decryptSecret(encrypted)
      expect(decrypted).toBe(secret)
    })

    it('should mask PAT display strings', () => {
      expect(maskPat('ghp_1234567890abcdef1234567890abcdef')).toBe('ghp_••••••••••••cdef')
      expect(maskPat('')).toBe('')
      expect(maskPat('short')).toBe('shor••••')
    })

    it('should save and load general & conversion settings with masked secrets', () => {
      saveSettings({
        general: {
          libraryDir: 'D:\\MyCustomLibrary',
          language: 'ko',
          theme: 'dark'
        },
        conversion: {
          defaultProfile: 'best_quality',
          concurrency: 4,
          llmProvider: 'openai',
          llmModel: 'gpt-4o'
        },
        llmApiKey: 'sk-proj-testApiKey987654321012345678',
        githubPat: 'ghp_myGitHubPersonalToken1234567890'
      })

      // Load for renderer (includeSecret = false)
      const publicSettings = loadSettings(false)
      expect(publicSettings.general.libraryDir).toBe('D:\\MyCustomLibrary')
      expect(publicSettings.general.theme).toBe('dark')
      expect(publicSettings.conversion.defaultProfile).toBe('best_quality')
      expect(publicSettings.conversion.concurrency).toBe(4)
      expect(publicSettings.conversion.llmProvider).toBe('openai')
      expect(publicSettings.conversion.llmModel).toBe('gpt-4o')

      // Plain secrets must NOT be exposed
      expect(publicSettings.conversion.llmApiKey).toBeUndefined()
      expect(publicSettings.github.pat).toBeUndefined()

      // Masked versions must be present
      expect(publicSettings.conversion.maskedLlmApiKey).toBeDefined()
      expect(publicSettings.conversion.maskedLlmApiKey).toContain('••••')
      expect(publicSettings.github.maskedPat).toBeDefined()
      expect(publicSettings.github.maskedPat).toContain('••••')

      // Load for main process (includeSecret = true)
      const internalSettings = loadSettings(true)
      expect(internalSettings.conversion.llmApiKey).toBe('sk-proj-testApiKey987654321012345678')
      expect(internalSettings.github.pat).toBe('ghp_myGitHubPersonalToken1234567890')
    })
  })
})
