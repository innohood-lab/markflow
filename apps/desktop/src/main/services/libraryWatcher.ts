import * as fs from 'fs'
import * as path from 'path'
import chokidar, { FSWatcher } from 'chokidar'
import { readDocumentFile } from './documentService'
import { saveConversion, getConversionBySlug, deleteConversion, ConversionRecord } from '../db'
import matter from 'gray-matter'

export interface LibraryWatchEvent {
  type: 'add' | 'change' | 'unlink'
  slug: string
  filePath: string
  record?: ConversionRecord | null
}

export type LibraryWatchCallback = (event: LibraryWatchEvent) => void

export class LibraryWatcher {
  private watcher: FSWatcher | null = null
  private libraryDir: string | null = null
  private callback: LibraryWatchCallback | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Start watching the Library folder for external additions, edits, or removals.
   */
  start(libraryDir: string, callback: LibraryWatchCallback): void {
    this.stop()
    this.libraryDir = libraryDir
    this.callback = callback

    if (!fs.existsSync(libraryDir)) {
      try {
        fs.mkdirSync(libraryDir, { recursive: true })
      } catch {
        return
      }
    }

    console.log(`[LibraryWatcher] Watching Library directory at: ${libraryDir}`)

    this.watcher = chokidar.watch(libraryDir, {
      ignored: /(^|[\/\\])\..|node_modules|assets/, // Ignore dotfiles, history, and assets folder
      persistent: true,
      ignoreInitial: true,
      depth: 0 // Only top-level markdown files in Library/
    })

    this.watcher.on('add', (filePath) => this.handleFileChange('add', filePath))
    this.watcher.on('change', (filePath) => this.handleFileChange('change', filePath))
    this.watcher.on('unlink', (filePath) => this.handleFileDelete(filePath))
  }

  private handleFileChange(type: 'add' | 'change', filePath: string): void {
    if (!filePath.endsWith('.md')) return

    // Debounce to allow text editors to complete multi-write / flush
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath)!)
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath)
      this.processFileUpdate(type, filePath)
    }, 600)

    this.debounceTimers.set(filePath, timer)
  }

  private processFileUpdate(type: 'add' | 'change', filePath: string): void {
    if (!fs.existsSync(filePath)) return

    try {
      const doc = readDocumentFile(filePath)
      if (!doc) return

      const slug = doc.slug
      const record = saveConversion({
        slug: doc.slug,
        title: doc.title,
        source_file: doc.source_file,
        source_type: doc.source_type,
        converted_at: doc.converted_at,
        library_path: filePath,
        status: doc.status,
        quality_score: doc.quality_score,
        tags: doc.tags,
        category: doc.category,
        first_image: doc.first_image,
        markdown: matter.stringify(doc.content, doc.data)
      })

      console.log(`[LibraryWatcher] External ${type} processed for: ${slug}`)
      if (this.callback) {
        this.callback({
          type,
          slug,
          filePath,
          record
        })
      }
    } catch (err) {
      console.warn(`[LibraryWatcher] Error processing file update for ${filePath}:`, err)
    }
  }

  private handleFileDelete(filePath: string): void {
    if (!filePath.endsWith('.md')) return
    const slug = path.basename(filePath, '.md')

    const existing = getConversionBySlug(slug)
    if (existing && existing.id) {
      deleteConversion(existing.id)
    }

    console.log(`[LibraryWatcher] External unlink processed for: ${slug}`)
    if (this.callback) {
      this.callback({
        type: 'unlink',
        slug,
        filePath
      })
    }
  }

  stop(): void {
    for (const t of this.debounceTimers.values()) {
      clearTimeout(t)
    }
    this.debounceTimers.clear()

    if (this.watcher) {
      this.watcher.close().catch(() => {})
      this.watcher = null
    }
  }
}
