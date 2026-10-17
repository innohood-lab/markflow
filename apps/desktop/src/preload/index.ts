import { contextBridge, ipcRenderer } from 'electron'

export interface EngineStatus {
  state: 'starting' | 'ready' | 'error' | 'stopped'
  port: number | null
  version?: string
  markitdownVersion?: string
  error?: string
}

export interface MarkFlowApi {
  getEngineStatus: () => Promise<EngineStatus>
  restartEngine: () => Promise<EngineStatus>
  onEngineStatusChange: (callback: (status: EngineStatus) => void) => () => void
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
  }
}

try {
  contextBridge.exposeInMainWorld('markflowApi', api)
} catch (error) {
  console.error('[Preload] Failed to expose markflowApi:', error)
}
