import { contextBridge, ipcRenderer } from 'electron'

export interface EngineStatus {
  state: 'starting' | 'ready' | 'error' | 'stopped'
  port: number | null
  version?: string
  markitdownVersion?: string
  error?: string
}

export interface ConversionRecord {
  id: number
  slug: string
  title: string
  source_file: string
  source_path?: string
  source_type: string
  file_size?: number
  converted_at: string
  library_path: string
  status?: string
  quality_score?: number | null
  markdown?: string
  exported_json?: string
  created_at?: string
}

export interface MarkFlowApi {
  getEngineStatus: () => Promise<EngineStatus>
  restartEngine: () => Promise<EngineStatus>
  onEngineStatusChange: (callback: (status: EngineStatus) => void) => () => void
  convertDocument: (filePath: string, libraryDir?: string) => Promise<any>
  selectFilesOrFolders: () => Promise<{ path: string; name: string; size: number }[]>
  getHistory: (params?: { search?: string; sort?: 'latest' | 'name' }) => Promise<ConversionRecord[]>
  deleteHistoryItem: (id: number) => Promise<ConversionRecord | null>
  restoreHistoryItem: (id: number) => Promise<ConversionRecord | null>
  showItemInFolder: (path: string) => Promise<boolean>
  copyToClipboard: (text: string) => Promise<boolean>
}

const api: MarkFlowApi = {
  getEngineStatus: () => ipcRenderer.invoke('engine:get-status'),
  restartEngine: () => ipcRenderer.invoke('engine:restart'),
  onEngineStatusChange: (callback: (status: EngineStatus) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, status: EngineStatus) => callback(status)
    ipcRenderer.on('engine:status-changed', subscription)
    return () => {
      ipcRenderer.removeListener('engine:status-changed', subscription)
    }
  },
  convertDocument: (filePath: string, libraryDir?: string) =>
    ipcRenderer.invoke('engine:convert', filePath, libraryDir),
  selectFilesOrFolders: () => ipcRenderer.invoke('dialog:open-files'),
  getHistory: (params) => ipcRenderer.invoke('db:get-history', params),
  deleteHistoryItem: (id: number) => ipcRenderer.invoke('db:delete-item', id),
  restoreHistoryItem: (id: number) => ipcRenderer.invoke('db:restore-item', id),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item', path),
  copyToClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text)
}

try {
  contextBridge.exposeInMainWorld('markflowApi', api)
} catch (error) {
  console.error('[Preload] Failed to expose markflowApi:', error)
}
