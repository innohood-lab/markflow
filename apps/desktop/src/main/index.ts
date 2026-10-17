import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { SidecarManager } from './sidecar'

let mainWindow: BrowserWindow | null = null
const sidecar = new SidecarManager()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 860,
    minHeight: 580,
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

// IPC Handlers
ipcMain.handle('engine:get-status', () => {
  return sidecar.getStatus()
})

ipcMain.handle('engine:restart', async () => {
  await sidecar.stop()
  return await sidecar.start()
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
