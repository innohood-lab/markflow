import { app, shell, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import { join, extname } from 'path'
import * as fs from 'fs'
import { SidecarManager } from './sidecar'
import { saveConversion, getConversions, deleteConversion, restoreConversion } from './db'

let mainWindow: BrowserWindow | null = null
const sidecar = new SidecarManager()

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

ipcMain.handle('engine:convert', async (_event, filePath: string, libraryDir?: string) => {
  const result = await sidecar.convertDocument(filePath, libraryDir)
  if (result.status === 'success') {
    // Save to SQLite
    const record = saveConversion({
      slug: result.slug,
      title: result.title,
      source_file: result.source_file,
      source_path: result.source_path,
      source_type: result.source_type,
      file_size: result.file_size,
      converted_at: result.converted_at,
      library_path: result.library_path,
      status: '미분류',
      markdown: result.markdown
    })
    return { ...result, id: record.id }
  }
  return result
})

// IPC Handlers: Database
ipcMain.handle('db:get-history', (_event, params) => {
  return getConversions(params)
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

// IPC Handlers: OS & Shell
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

app.whenReady().then(async () => {
  createWindow()

  // Start sidecar in background
  sidecar.start().catch((err) => {
    console.error('[Main] Failed to start sidecar on app ready:', err)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
