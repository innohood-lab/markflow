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
  profile?: string
  markdown?: string
  exported_json?: string
  created_at?: string
}

export interface MarkFlowApi {
  getEngineStatus: () => Promise<EngineStatus>
  restartEngine: () => Promise<EngineStatus>
  onEngineStatusChange: (callback: (status: EngineStatus) => void) => () => void
  convertDocument: (filePath: string, libraryDir?: string, profile?: string, llmConfig?: any) => Promise<any>
  selectFilesOrFolders: () => Promise<{ path: string; name: string; size: number }[]>
  getHistory: (params?: { search?: string; sort?: 'latest' | 'name'; reviewOnly?: boolean }) => Promise<ConversionRecord[]>
  getReviewCount: () => Promise<number>
  deleteHistoryItem: (id: number) => Promise<ConversionRecord | null>
  restoreHistoryItem: (id: number) => Promise<ConversionRecord | null>
  showItemInFolder: (path: string) => Promise<boolean>
  copyToClipboard: (text: string) => Promise<boolean>
  getAssetDataUrl: (relPath: string) => Promise<string | null>
  openPath: (filePath: string) => Promise<string>
  saveMarkdown: (
    id: number,
    libraryPath: string,
    fullMarkdown: string,
    title?: string,
    status?: string
  ) => Promise<{ success: boolean; item?: any; error?: string }>
  backupAndReconvert: (
    id: number,
    sourcePath: string,
    libraryPath: string,
    slug: string,
    profile: string
  ) => Promise<any>
  getOriginalFileUrl: (filePath: string) => Promise<string | null>
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
  convertDocument: (filePath: string, libraryDir?: string, profile?: string, llmConfig?: any) =>
    ipcRenderer.invoke('engine:convert', filePath, libraryDir, profile, llmConfig),
  selectFilesOrFolders: () => ipcRenderer.invoke('dialog:open-files'),
  getHistory: (params) => ipcRenderer.invoke('db:get-history', params),
  getReviewCount: () => ipcRenderer.invoke('db:get-review-count'),
  deleteHistoryItem: (id: number) => ipcRenderer.invoke('db:delete-item', id),
  restoreHistoryItem: (id: number) => ipcRenderer.invoke('db:restore-item', id),
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item', path),
  copyToClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  getAssetDataUrl: (relPath: string) => ipcRenderer.invoke('library:get-asset-data-url', relPath),
  openPath: (filePath: string) => ipcRenderer.invoke('shell:open-path', filePath),
  saveMarkdown: (id: number, libraryPath: string, fullMarkdown: string, title?: string, status?: string) =>
    ipcRenderer.invoke('library:save-markdown', id, libraryPath, fullMarkdown, title, status),
  backupAndReconvert: (id: number, sourcePath: string, libraryPath: string, slug: string, profile: string) =>
    ipcRenderer.invoke('library:backup-and-reconvert', id, sourcePath, libraryPath, slug, profile),
  getOriginalFileUrl: (filePath: string) => ipcRenderer.invoke('library:read-original-file-url', filePath)
}

try {
  contextBridge.exposeInMainWorld('markflowApi', api)
} catch (error) {
  console.error('[Preload] Failed to expose markflowApi:', error)
}
