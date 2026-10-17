import { app, shell, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import { join, extname } from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { SidecarManager } from './sidecar'
import {
  saveConversion,
  getConversions,
  getReviewNeededCount,
  deleteConversion,
  restoreConversion,
  updateConversion,
  getConversionById
} from './db'
import {
  loadSettings,
  saveSettings,
  testGitHubConnection,
  validateObsidianVault,
  getDefaultVaultHint,
  exportDocumentsToCloudDestination
} from './services/settingsService'
import { exportDocumentsToGitHub } from './services/githubExporter'
import { exportDocumentsToObsidian } from './services/obsidianExporter'
import { LocalFolderAdapter } from './services/storageAdapter'
import { detectCloudStorageFolders } from './services/cloudDetector'
import { WatchFolderService } from './services/watchFolderService'
import {
  updateDocumentFrontmatter,
  createNewDocument,
  duplicateDocument,
  archiveDocument,
  rebuildLibraryIndex,
  batchUpdateDocuments
} from './services/documentService'
import { LibraryWatcher } from './services/libraryWatcher'
import {
  getAreaHierarchy,
  addArea,
  addProject,
  deleteAreaOrProject,
  assignDocumentToGroup,
  getSmartGroups,
  saveSmartGroup,
  deleteSmartGroup,
  toggleStarDocument
} from './services/smartGroupService'

let mainWindow: BrowserWindow | null = null
const sidecar = new SidecarManager()
const watchFolderService = new WatchFolderService(5000)
const libraryWatcher = new LibraryWatcher()

function getLibraryDir(): string {
  const home = app.getPath('documents')
  const dir = join(home, 'MarkFlow', 'Library')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

const SUPPORTED_EXTS = new Set([
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

function scanFolderForFiles(dirPath: string): string[] {
  const results: string[] = []
  function recurse(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          recurse(fullPath)
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase()
          if (SUPPORTED_EXTS.has(ext)) {
            results.push(fullPath)
          }
        }
      }
    } catch (err) {
      console.warn(`[Main] Error scanning folder ${dir}:`, err)
    }
  }
  recurse(dirPath)
  return results
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    title: 'MarkFlow',
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Listen to sidecar status changes and notify renderer
  sidecar.onStatusChange((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('engine:status-changed', status)
    }
  })

  // Load URL or local HTML
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers: Engine
ipcMain.handle('engine:get-status', () => {
  return sidecar.getStatus()
})

ipcMain.handle('engine:restart', async () => {
  await sidecar.stop()
  return await sidecar.start()
})

ipcMain.handle(
  'engine:convert',
  async (_event, filePath: string, libraryDir?: string, profile?: string, llmConfig?: any, sourceLocation?: string) => {
    let fileHash = ''
    try {
      if (fs.existsSync(filePath)) {
        fileHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
      }
    } catch {}

    const result = await sidecar.convertDocument(filePath, libraryDir, profile || 'balanced', llmConfig)
    if (result.status === 'success') {
      let finalMarkdown = result.markdown
      if (sourceLocation && result.library_path && fs.existsSync(result.library_path)) {
        try {
          let md = fs.readFileSync(result.library_path, 'utf-8')
          md = md.replace(/source_location:\s*""/, `source_location: "${sourceLocation}"`)
          fs.writeFileSync(result.library_path, md, 'utf-8')
          finalMarkdown = md
        } catch {}
      }

      // Save to SQLite
      const record = saveConversion({
        slug: result.slug,
        title: result.title,
        source_file: result.source_file,
        source_path: result.source_path,
        source_type: result.source_type,
        source_location: sourceLocation || '',
        file_hash: fileHash,
        file_size: result.file_size,
        converted_at: result.converted_at,
        library_path: result.library_path,
        status: result.quality_report?.review_needed ? 'review_needed' : 'inbox',
        quality_score: result.quality_score ?? null,
        profile: result.profile || profile || 'balanced',
        markdown: finalMarkdown
      })

      // Auto-export if enabled in settings
      try {
        const settings = loadSettings(true)
        if (settings.autoExport.enabled && settings.autoExport.target !== 'none') {
          const docs = [record]
          if (settings.autoExport.target === 'github' || settings.autoExport.target === 'both') {
            exportDocumentsToGitHub(docs).catch((e) => console.error('[AutoExport] GitHub export failed:', e))
          }
          if (settings.autoExport.target === 'obsidian' || settings.autoExport.target === 'both') {
            exportDocumentsToObsidian(docs).catch((e) => console.error('[AutoExport] Obsidian export failed:', e))
          }
        }
      } catch (err) {
        console.warn('[AutoExport] Error during auto-export check:', err)
      }

      return { ...result, id: record.id }
    }
    return result
  }
)

// IPC Handlers: Database
ipcMain.handle('db:get-history', (_event, params) => {
  return getConversions(params)
})

ipcMain.handle('db:get-review-count', () => {
  return getReviewNeededCount()
})

ipcMain.handle('db:delete-item', async (_event, id: number) => {
  const deletedItem = deleteConversion(id)
  if (deletedItem && deletedItem.library_path && fs.existsSync(deletedItem.library_path)) {
    try {
      await shell.trashItem(deletedItem.library_path)
    } catch (e) {
      console.warn('[Main] Failed to trash file:', e)
    }
  }
  return deletedItem
})

ipcMain.handle('db:restore-item', (_event, id: number) => {
  return restoreConversion(id)
})

ipcMain.handle(
  'library:save-markdown',
  async (_event, id: number, libraryPath: string, fullMarkdown: string, title?: string, status?: string) => {
    try {
      if (fs.existsSync(libraryPath)) {
        fs.writeFileSync(libraryPath, fullMarkdown, 'utf-8')
      }
      const updated = updateConversion(id, {
        markdown: fullMarkdown,
        title: title,
        status: status
      })
      return { success: true, item: updated }
    } catch (err: any) {
      console.error('[Main] Save markdown error:', err)
      return { success: false, error: err?.message || String(err) }
    }
  }
)

ipcMain.handle(
  'library:backup-and-reconvert',
  async (_event, id: number, sourcePath: string, libraryPath: string, slug: string, profile: string) => {
    try {
      // 1. Backup existing markdown to Library/.history/
      const home = app.getPath('documents')
      const historyDir = join(home, 'MarkFlow', 'Library', '.history')
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true })
      }

      if (fs.existsSync(libraryPath)) {
        const backupFileName = `${slug}.${Date.now()}.md`
        fs.copyFileSync(libraryPath, join(historyDir, backupFileName))
      }

      // 2. Run sidecar reconversion
      const res = await sidecar.convertDocument(sourcePath, undefined, profile)
      if (res.status === 'success') {
        const updated = updateConversion(id, {
          markdown: res.markdown,
          quality_score: res.quality_score ?? null,
          profile: profile,
          status: res.quality_report?.review_needed ? 'review_needed' : 'inbox'
        })
        return { success: true, result: res, item: updated }
      }
      return { success: false, message: res.message || '재변환 실패' }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) }
    }
  }
)

ipcMain.handle('library:get-asset-data-url', async (_event, relPath: string) => {
  try {
    const home = app.getPath('documents')
    const fullPath = join(home, 'MarkFlow', 'Library', relPath)
    if (fs.existsSync(fullPath)) {
      const ext = extname(fullPath).toLowerCase().replace('.', '')
      const mime = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png')
      const data = fs.readFileSync(fullPath).toString('base64')
      return `data:${mime};base64,${data}`
    }
  } catch (err) {
    console.warn('[Main] Failed to read asset:', err)
  }
  return null
})

ipcMain.handle('library:read-original-file-url', async (_event, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      const ext = extname(filePath).toLowerCase()
      const buffer = fs.readFileSync(filePath)
      if (ext === '.pdf') {
        return `data:application/pdf;base64,${buffer.toString('base64')}`
      } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg')
        return `data:${mime};base64,${buffer.toString('base64')}`
      } else if (['.html', '.htm'].includes(ext)) {
        return buffer.toString('utf-8')
      }
    }
  } catch (err) {
    console.warn('[Main] Error reading original file:', err)
  }
  return null
})

// IPC Handlers: OS & Shell
ipcMain.handle('shell:open-path', async (_event, filePath: string) => {
  if (fs.existsSync(filePath)) {
    return await shell.openPath(filePath)
  }
  return '파일이 존재하지 않습니다.'
})
ipcMain.handle('dialog:open-files', async () => {
  if (!mainWindow) return []
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '변환할 문서 또는 폴더 선택',
    properties: ['openFile', 'openDirectory', 'multiSelections']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return []
  }

  const allFiles: { path: string; name: string; size: number }[] = []
  for (const p of result.filePaths) {
    try {
      const stat = fs.statSync(p)
      if (stat.isDirectory()) {
        const found = scanFolderForFiles(p)
        for (const fp of found) {
          try {
            const fstat = fs.statSync(fp)
            allFiles.push({ path: fp, name: join(fp).split(/[\\/]/).pop() || '', size: fstat.size })
          } catch {}
        }
      } else if (stat.isFile()) {
        allFiles.push({ path: p, name: p.split(/[\\/]/).pop() || '', size: stat.size })
      }
    } catch (err) {
      console.warn(`[Main] Error stat path ${p}:`, err)
    }
  }

  return allFiles
})

ipcMain.handle('shell:show-item', (_event, filePath: string) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath)
    return true
  }
  return false
})

ipcMain.handle('clipboard:write', (_event, text: string) => {
  clipboard.writeText(text)
  return true
})

// IPC Handlers: Settings
ipcMain.handle('settings:get', () => {
  return {
    settings: loadSettings(false),
    vaultHint: getDefaultVaultHint()
  }
})

ipcMain.handle('settings:save', (_event, updates: any) => {
  return saveSettings(updates)
})

ipcMain.handle(
  'settings:test-github',
  async (_event, params: { owner: string; repo: string; branch: string; pat?: string }) => {
    return await testGitHubConnection(params.owner, params.repo, params.branch, params.pat)
  }
)

ipcMain.handle('settings:pick-obsidian-vault', async () => {
  if (!mainWindow) return { canceled: true }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Obsidian 볼트 폴더 선택 (.obsidian 포함)',
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const selectedPath = result.filePaths[0]
  const validation = validateObsidianVault(selectedPath)
  return {
    canceled: false,
    path: selectedPath,
    validation
  }
})

// IPC Handlers: Export
ipcMain.handle(
  'export:documents',
  async (_event, params: { targets: 'github' | 'obsidian' | 'both'; itemIds: number[] }) => {
    const { targets, itemIds } = params
    if (!itemIds || itemIds.length === 0) {
      return { success: false, message: '내보낼 항목이 선택되지 않았습니다.' }
    }

    const docs = itemIds
      .map((id) => getConversionById(id))
      .filter((d): d is NonNullable<typeof d> => d !== null)

    if (docs.length === 0) {
      return { success: false, message: '내보낼 문서를 찾을 수 없습니다.' }
    }

    let githubResult = null
    let obsidianResult = null

    if (targets === 'github' || targets === 'both') {
      githubResult = await exportDocumentsToGitHub(docs)
    }

    if (targets === 'obsidian' || targets === 'both') {
      obsidianResult = await exportDocumentsToObsidian(docs)
    }

    const isSuccess =
      (targets === 'github' && githubResult?.success) ||
      (targets === 'obsidian' && obsidianResult?.success) ||
      (targets === 'both' && (githubResult?.success || obsidianResult?.success))

    return {
      success: !!isSuccess,
      githubResult,
      obsidianResult,
      message:
        targets === 'both'
          ? `내보내기 완료 (GitHub: ${githubResult?.success ? '성공' : '실패'}, Obsidian: ${obsidianResult?.success ? '성공' : '실패'})`
          : targets === 'github'
            ? githubResult?.message
            : obsidianResult?.message
    }
  }
)

// IPC Handlers: Cloud Storage
ipcMain.handle('cloud:detect-providers', () => {
  const settings = loadSettings(false)
  return detectCloudStorageFolders(settings.customCloudFolders || [])
})

ipcMain.handle('cloud:list-files', async (_event, folderPath: string) => {
  const adapter = new LocalFolderAdapter('Explorer', folderPath)
  return await adapter.list(folderPath)
})

ipcMain.handle('cloud:pick-folder', async () => {
  if (!mainWindow) return { canceled: true }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '클라우드 동기화 또는 로컬 폴더 선택',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }
  return { canceled: false, path: result.filePaths[0] }
})

ipcMain.handle(
  'cloud:export-destination',
  async (_event, params: { destinationId: string; itemIds: number[] }) => {
    const settings = loadSettings(false)
    const dest = settings.cloudDestinations.find((d) => d.id === params.destinationId)
    if (!dest) {
      return { success: false, message: '등록된 저장 대상을 찾을 수 없습니다.' }
    }
    const docs = params.itemIds
      .map((id) => getConversionById(id))
      .filter((d): d is NonNullable<typeof d> => d !== null)
    return await exportDocumentsToCloudDestination(docs, dest)
  }
)

// IPC Handlers: Watch Folder
ipcMain.handle('watch:reload', () => {
  const settings = loadSettings(false)
  const activeWatchPaths = (settings.watchFolders || [])
    .filter((w) => w.enabled)
    .map((w) => w.path)

  watchFolderService.start(activeWatchPaths, (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('watch:file-detected', event)
    }
  })
  return { success: true, count: activeWatchPaths.length }
})

// IPC Handlers: Phase 7 Board & Documents
ipcMain.handle('board:get-documents', (_event, params) => {
  return getConversions(params)
})

ipcMain.handle('board:update-frontmatter', (_event, slug: string, updates: Record<string, any>) => {
  return updateDocumentFrontmatter(slug, updates)
})

ipcMain.handle('board:create-document', (_event, params: any) => {
  return createNewDocument({ ...params, libraryDir: getLibraryDir() })
})

ipcMain.handle('board:duplicate-document', (_event, slug: string) => {
  return duplicateDocument(slug, getLibraryDir())
})

ipcMain.handle('board:archive-document', (_event, slug: string, isArchived: boolean) => {
  return archiveDocument(slug, isArchived)
})

ipcMain.handle('board:rebuild-index', () => {
  return rebuildLibraryIndex(getLibraryDir())
})

ipcMain.handle('board:batch-update', (_event, slugs: string[], operations: any) => {
  return batchUpdateDocuments(slugs, operations)
})

// IPC Handlers: Phase 8-(가) Groups & Smart Groups & Today
ipcMain.handle('group:get-areas', () => {
  return getAreaHierarchy()
})

ipcMain.handle('group:add-area', (_event, name: string) => {
  return addArea(name)
})

ipcMain.handle('group:add-project', (_event, areaId: string, projectName: string) => {
  return addProject(areaId, projectName)
})

ipcMain.handle('group:delete-area-or-project', (_event, id: string) => {
  return deleteAreaOrProject(id)
})

ipcMain.handle('group:assign-document', (_event, slug: string, groupPath: string, replace?: boolean) => {
  return assignDocumentToGroup(slug, groupPath, replace)
})

ipcMain.handle('smart-group:get-all', () => {
  return getSmartGroups()
})

ipcMain.handle('smart-group:save', (_event, group: any) => {
  return saveSmartGroup(group)
})

ipcMain.handle('smart-group:delete', (_event, id: string) => {
  return deleteSmartGroup(id)
})

ipcMain.handle('doc:toggle-star', (_event, id: number) => {
  return toggleStarDocument(id)
})

app.whenReady().then(async () => {
  createWindow()

  // Start sidecar in background
  sidecar.start().catch((err) => {
    console.error('[Main] Failed to start sidecar on app ready:', err)
  })

  // Start watch folder service
  try {
    const settings = loadSettings(false)
    const activeWatchPaths = (settings.watchFolders || [])
      .filter((w) => w.enabled)
      .map((w) => w.path)
    watchFolderService.start(activeWatchPaths, (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('watch:file-detected', event)
      }
    })
  } catch (err) {
    console.warn('[Main] Failed to initialize watch folder service:', err)
  }

  // Start library watcher for external changes
  try {
    const libDir = getLibraryDir()
    libraryWatcher.start(libDir, (event) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('library:external-changed', event)
      }
    })
  } catch (err) {
    console.warn('[Main] Failed to initialize library watcher:', err)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
