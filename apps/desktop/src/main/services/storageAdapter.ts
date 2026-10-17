import * as fs from 'fs'
import * as path from 'path'

export const SUPPORTED_EXTS = new Set([
  '.docx',
  '.pptx',
  '.xlsx',
  '.xls',
  '.pdf',
  '.html',
  '.htm',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.csv',
  '.txt',
  '.json',
  '.xml',
  '.zip'
])

export interface StorageItem {
  id: string
  name: string
  path: string
  isDirectory: boolean
  size: number
  updatedAt: string
  isPlaceholder?: boolean
  isSupported?: boolean
  sourceType?: string
}

export interface StorageAdapter {
  name: string
  type: 'local_sync' | 'cloud_api'
  list(folderPath?: string): Promise<StorageItem[]>
  read(itemPath: string, destLocalPath: string): Promise<string>
  write(destPath: string, content: Buffer | string): Promise<string>
  exists(itemPath: string): Promise<boolean>
}

/**
 * Local folder storage adapter for Google Drive, OneDrive, Dropbox, iCloud Drive sync folders,
 * as well as standard local folders.
 */
export class LocalFolderAdapter implements StorageAdapter {
  name: string
  type: 'local_sync' = 'local_sync'
  basePath: string

  constructor(name: string, basePath: string) {
    this.name = name
    this.basePath = basePath
  }

  /**
   * Determine if a file is an iCloud or cloud on-demand placeholder file.
   */
  isPlaceholderFile(filename: string): boolean {
    // macOS / Windows iCloud Drive placeholder pattern: .<filename>.icloud
    if (filename.startsWith('.') && filename.endsWith('.icloud')) {
      return true
    }
    return false
  }

  /**
   * Strip placeholder prefix/suffix to retrieve the original filename
   * e.g. ".Argos_구조도.pdf.icloud" -> "Argos_구조도.pdf"
   */
  normalizePlaceholderName(filename: string): string {
    if (filename.startsWith('.') && filename.endsWith('.icloud')) {
      return filename.slice(1, -7)
    }
    return filename
  }

  async list(folderPath?: string): Promise<StorageItem[]> {
    const targetDir = folderPath || this.basePath
    if (!fs.existsSync(targetDir)) {
      return []
    }

    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true })
      const items: StorageItem[] = []

      for (const entry of entries) {
        // Skip system hidden files except iCloud placeholders
        if (entry.name.startsWith('.') && !entry.name.endsWith('.icloud')) {
          continue
        }

        const fullPath = path.join(targetDir, entry.name)
        let isPlaceholder = false
        let displayName = entry.name
        let isDir = entry.isDirectory()
        let size = 0
        let updatedAt = new Date().toISOString()

        try {
          const stat = fs.statSync(fullPath)
          size = stat.size
          updatedAt = stat.mtime.toISOString()
        } catch {
          // If stat fails (e.g. permission or offline placeholder), fallback gracefully
        }

        if (this.isPlaceholderFile(entry.name)) {
          isPlaceholder = true
          displayName = this.normalizePlaceholderName(entry.name)
          isDir = false
        }

        const ext = path.extname(displayName).toLowerCase()
        const isSupported = isDir || SUPPORTED_EXTS.has(ext)

        items.push({
          id: fullPath,
          name: displayName,
          path: fullPath,
          isDirectory: isDir,
          size,
          updatedAt,
          isPlaceholder,
          isSupported,
          sourceType: ext.replace(/^\./, '') || (isDir ? 'folder' : 'unknown')
        })
      }

      // Sort: folders first, then files alphabetically
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })

      return items
    } catch (err) {
      console.error(`[LocalFolderAdapter] Failed to list directory ${targetDir}:`, err)
      return []
    }
  }

  async read(itemPath: string, destLocalPath: string): Promise<string> {
    if (!fs.existsSync(itemPath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${itemPath}`)
    }

    const filename = path.basename(itemPath)
    if (this.isPlaceholderFile(filename)) {
      throw new Error(
        `온라인 전용 파일(${this.normalizePlaceholderName(filename)})입니다. 클라우드 앱에서 먼저 다운로드해 주세요.`
      )
    }

    fs.mkdirSync(path.dirname(destLocalPath), { recursive: true })
    fs.copyFileSync(itemPath, destLocalPath)
    return destLocalPath
  }

  async write(destPath: string, content: Buffer | string): Promise<string> {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    if (typeof content === 'string') {
      fs.writeFileSync(destPath, content, 'utf-8')
    } else {
      fs.writeFileSync(destPath, content)
    }
    return destPath
  }

  async exists(itemPath: string): Promise<boolean> {
    return fs.existsSync(itemPath)
  }
}
