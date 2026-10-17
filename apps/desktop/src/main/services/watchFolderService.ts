import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import chokidar, { FSWatcher } from 'chokidar'
import { SUPPORTED_EXTS } from './storageAdapter'
import { findConversionByHash } from '../db'

export interface WatchFileEvent {
  filePath: string
  fileName: string
  fileHash: string
  fileSize: number
  sourceLocation: string
}

export type WatchFileCallback = (event: WatchFileEvent) => void

export class WatchFolderService {
  private watcher: FSWatcher | null = null
  private watchedPaths: Set<string> = new Set()
  private pendingDebounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private pendingFileSizes: Map<string, number> = new Map()
  private callback: WatchFileCallback | null = null
  private stabilizationDelayMs: number

  constructor(stabilizationDelayMs = 5000) {
    this.stabilizationDelayMs = stabilizationDelayMs
  }

  /**
   * Calculate SHA-256 hash of a file for duplicate detection.
   */
  computeFileHash(filePath: string): string {
    const buffer = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  /**
   * Start watching folders with debounced stabilization.
   */
  start(folders: string[], callback: WatchFileCallback): void {
    this.callback = callback
    this.stop()

    const validFolders = folders.filter((f) => fs.existsSync(f))
    validFolders.forEach((f) => this.watchedPaths.add(path.resolve(f)))

    if (this.watchedPaths.size === 0) {
      console.log('[WatchFolder] No active folders to watch.')
      return
    }

    console.log(`[WatchFolder] Starting watcher for ${this.watchedPaths.size} folders:`, Array.from(this.watchedPaths))

    this.watcher = chokidar.watch(Array.from(this.watchedPaths), {
      ignored: /(^|[\/\\])\..|node_modules/, // Ignore dotfiles except placeholders
      persistent: true,
      ignoreInitial: true,
      depth: 3
    })

    this.watcher.on('add', (filePath) => this.handleFileEvent(filePath))
    this.watcher.on('change', (filePath) => this.handleFileEvent(filePath))
  }

  /**
   * Handle add or change event by waiting for file stabilization (e.g. 5 seconds).
   */
  private handleFileEvent(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase()
    if (!SUPPORTED_EXTS.has(ext)) {
      return
    }

    // Cancel existing debounce timer if file is still being written
    if (this.pendingDebounceTimers.has(filePath)) {
      clearTimeout(this.pendingDebounceTimers.get(filePath)!)
    }

    const timer = setTimeout(() => {
      this.pendingDebounceTimers.delete(filePath)
      this.verifyAndDispatch(filePath)
    }, this.stabilizationDelayMs)

    this.pendingDebounceTimers.set(filePath, timer)
  }

  /**
   * Verify file size is stable and check hash against DB to avoid re-conversion loops.
   */
  private verifyAndDispatch(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      return
    }

    try {
      const stat = fs.statSync(filePath)
      if (stat.size === 0) {
        return // Still zero bytes or placeholder
      }

      // Check if size was stable compared to last recorded
      const prevSize = this.pendingFileSizes.get(filePath)
      if (prevSize !== undefined && prevSize !== stat.size) {
        // Size changed! Reset timer
        this.pendingFileSizes.set(filePath, stat.size)
        this.handleFileEvent(filePath)
        return
      }

      this.pendingFileSizes.delete(filePath)

      // Compute hash
      const hash = this.computeFileHash(filePath)

      // Deduplication check via SQLite
      const existing = findConversionByHash(hash)
      if (existing) {
        console.log(`[WatchFolder] File ${path.basename(filePath)} already converted (hash: ${hash.slice(0, 8)}), skipping.`)
        return
      }

      const fileName = path.basename(filePath)
      const sourceLocation = `Watch:${filePath}`

      console.log(`[WatchFolder] New stable document detected: ${fileName} (${stat.size} bytes)`)

      if (this.callback) {
        this.callback({
          filePath,
          fileName,
          fileHash: hash,
          fileSize: stat.size,
          sourceLocation
        })
      }
    } catch (err) {
      console.warn(`[WatchFolder] Error verifying file ${filePath}:`, err)
    }
  }

  addFolder(folderPath: string): void {
    if (!fs.existsSync(folderPath)) return
    const resolved = path.resolve(folderPath)
    if (!this.watchedPaths.has(resolved)) {
      this.watchedPaths.add(resolved)
      this.watcher?.add(resolved)
    }
  }

  removeFolder(folderPath: string): void {
    const resolved = path.resolve(folderPath)
    if (this.watchedPaths.has(resolved)) {
      this.watchedPaths.delete(resolved)
      this.watcher?.unwatch(resolved)
    }
  }

  getWatchedFolders(): string[] {
    return Array.from(this.watchedPaths)
  }

  stop(): void {
    for (const timer of this.pendingDebounceTimers.values()) {
      clearTimeout(timer)
    }
    this.pendingDebounceTimers.clear()
    this.pendingFileSizes.clear()

    if (this.watcher) {
      this.watcher.close().catch(() => {})
      this.watcher = null
    }
    this.watchedPaths.clear()
  }
}
