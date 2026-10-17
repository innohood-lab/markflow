import * as fs from 'fs'
import * as path from 'path'
import { createRequire } from 'module'

const nodeRequire = createRequire(import.meta.url)
function getElectron(): { app?: any; shell?: any } | null {
  if (!process.versions?.electron) return null
  try {
    return nodeRequire('electron')
  } catch {
    return null
  }
}

export function maskSensitiveData(input: string): string {
  if (!input) return ''

  let text = input

  // GitHub tokens (classic PAT, fine-grained PAT, oauth)
  text = text.replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_****')
  text = text.replace(/gh[ous]_[a-zA-Z0-9]{20,}/g, 'gh*k_****')
  text = text.replace(/github_pat_[a-zA-Z0-9_]{20,}/g, 'github_pat_****')

  // OpenAI / generic sk- keys
  text = text.replace(/sk-[a-zA-Z0-9_\-]{20,}/g, 'sk-****')

  // Google Gemini API keys (AIzaSy...)
  text = text.replace(/AIzaSy[a-zA-Z0-9_\-]{20,}/g, 'AIzaSy****')

  // Bearer tokens in headers or logs
  text = text.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{10,}/gi, 'Bearer ****')

  // Generic key/token/secret key-value pairs (e.g. "apiKey": "xyz", password="xyz")
  text = text.replace(
    /(["']?(?:apiKey|api_key|secret|password|accessToken|token)["']?\s*[:=]\s*["'])([^"'\s]{4,})(["'])/gi,
    '$1****$3'
  )

  return text
}

export class LoggerService {
  private customLogDir: string | null = null

  constructor(customLogDir?: string) {
    if (customLogDir) {
      this.customLogDir = customLogDir
    }
  }

  public getLogDir(): string {
    if (this.customLogDir) {
      if (!fs.existsSync(this.customLogDir)) {
        fs.mkdirSync(this.customLogDir, { recursive: true })
      }
      return this.customLogDir
    }

    let baseDir = ''
    try {
      const electron = getElectron()
      if (electron?.app && typeof electron.app.getPath === 'function') {
        baseDir = electron.app.getPath('userData')
      }
    } catch {
      // Fallback if app is not initialized yet or in test runner
    }

    if (!baseDir) {
      baseDir = process.env.APPDATA || process.env.HOME || process.cwd()
      baseDir = path.join(baseDir, '.markflow')
    }

    const logDir = path.join(baseDir, 'logs')
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true })
      } catch (err) {
        console.error('[LoggerService] Failed to create log directory:', err)
      }
    }
    return logDir
  }

  private getTodayLogFilePath(): string {
    const logDir = this.getLogDir()
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return path.join(logDir, `markflow-${yyyy}-${mm}-${dd}.log`)
  }

  private formatMessage(level: string, message: string, ...meta: any[]): string {
    const now = new Date()
    const timestamp = now.toISOString().replace('T', ' ').replace('Z', '')
    let metaStr = ''
    if (meta.length > 0) {
      try {
        metaStr = ' ' + meta.map((m) => (typeof m === 'object' ? JSON.stringify(m) : String(m))).join(' ')
      } catch {
        metaStr = ' [Unserializable meta]'
      }
    }
    const raw = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`
    return maskSensitiveData(raw)
  }

  public write(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, ...meta: any[]): void {
    const logLine = this.formatMessage(level, message, ...meta)

    // Console output for development
    if (level === 'ERROR') {
      console.error(logLine.trimEnd())
    } else if (level === 'WARN') {
      console.warn(logLine.trimEnd())
    } else {
      console.log(logLine.trimEnd())
    }

    // File append
    try {
      const filePath = this.getTodayLogFilePath()
      fs.appendFileSync(filePath, logLine, 'utf-8')
    } catch (err) {
      console.error('[LoggerService] Failed to write to log file:', err)
    }
  }

  public info(message: string, ...meta: any[]): void {
    this.write('INFO', message, ...meta)
  }

  public warn(message: string, ...meta: any[]): void {
    this.write('WARN', message, ...meta)
  }

  public error(message: string, ...meta: any[]): void {
    this.write('ERROR', message, ...meta)
  }

  public debug(message: string, ...meta: any[]): void {
    this.write('DEBUG', message, ...meta)
  }

  /**
   * Delete log files older than retentionDays (default 7 days)
   */
  public cleanOldLogs(retentionDays: number = 7): number {
    const logDir = this.getLogDir()
    if (!fs.existsSync(logDir)) return 0

    let deletedCount = 0
    const now = Date.now()
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000

    try {
      const files = fs.readdirSync(logDir)
      for (const file of files) {
        if (!file.startsWith('markflow-') || !file.endsWith('.log')) continue

        const filePath = path.join(logDir, file)
        try {
          const stats = fs.statSync(filePath)
          const fileAge = now - stats.mtimeMs

          // Also check date in filename
          const match = file.match(/^markflow-(\d{4})-(\d{2})-(\d{2})\.log$/)
          let isOlderThanRetention = fileAge > maxAgeMs
          if (match) {
            const fileDate = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`).getTime()
            if (!isNaN(fileDate) && now - fileDate > maxAgeMs) {
              isOlderThanRetention = true
            }
          }

          if (isOlderThanRetention) {
            fs.unlinkSync(filePath)
            deletedCount++
          }
        } catch (fileErr) {
          console.warn(`[LoggerService] Failed to check/delete old log file: ${file}`, fileErr)
        }
      }
    } catch (err) {
      console.error('[LoggerService] Failed during old log cleanup:', err)
    }

    return deletedCount
  }

  /**
   * Open the log directory in system file explorer
   */
  public async openLogFolder(): Promise<string> {
    const logDir = this.getLogDir()
    const electron = getElectron()
    if (electron?.shell && typeof electron.shell.openPath === 'function') {
      await electron.shell.openPath(logDir)
    }
    return logDir
  }
}

export const logger = new LoggerService()
