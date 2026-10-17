import { contextBridge, ipcRenderer } from 'electron'

export interface EngineStatus {
  state: 'starting' | 'ready' | 'error' | 'stopped'
  port: number | null
  version?: string
  markitdownVersion?: string
  error?: string
}

export interface ConversionRecord {
  id?: number
  slug: string
  title: string
  source_file: string
  source_path?: string
  source_type: string
  source_location?: string
  file_hash?: string
  file_size?: number
  converted_at: string
  library_path: string
  status?: string
  quality_score?: number | null
  profile?: string
  markdown?: string
  exported_json?: string
  tags?: string[]
  tags_json?: string
  category?: string
  first_image?: string
  custom_json?: string
  is_deleted?: number
  created_at?: string
}

export interface MarkFlowApi {
  getEngineStatus: () => Promise<EngineStatus>
  restartEngine: () => Promise<EngineStatus>
  onEngineStatusChange: (callback: (status: EngineStatus) => void) => () => void
  convertDocument: (
    filePath: string,
    libraryDir?: string,
    profile?: string,
    llmConfig?: any,
    sourceLocation?: string
  ) => Promise<any>
  selectFilesOrFolders: () => Promise<{ path: string; name: string; size: number }[]>
  getHistory: (params?: {
    search?: string
    sort?: 'latest' | 'name' | 'score'
    reviewOnly?: boolean
    status?: string
    category?: string
    tag?: string
    includeArchived?: boolean
  }) => Promise<ConversionRecord[]>
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
  getSettings: () => Promise<{ settings: any; vaultHint: string }>
  saveSettings: (updates: any) => Promise<any>
  testGitHubConnection: (params: {
    owner: string
    repo: string
    branch: string
    pat?: string
  }) => Promise<{ success: boolean; message: string }>
  pickObsidianVault: () => Promise<{
    canceled: boolean
    path?: string
    validation?: { valid: boolean; message: string }
  }>
  pickLibraryFolder: () => Promise<{ canceled: boolean; path?: string }>
  exportDocuments: (params: {
    targets: 'github' | 'obsidian' | 'both'
    itemIds: number[]
  }) => Promise<{
    success: boolean
    message: string
    githubResult?: any
    obsidianResult?: any
  }>
  detectCloudProviders: () => Promise<any[]>
  listCloudFiles: (folderPath: string) => Promise<any[]>
  pickCloudFolder: () => Promise<{ canceled: boolean; path?: string }>
  exportToCloudDestination: (params: { destinationId: string; itemIds: number[] }) => Promise<any>
  reloadWatchFolders: () => Promise<{ success: boolean; count: number }>
  onWatchFileDetected: (callback: (fileEvent: any) => void) => () => void

  // Phase 7: Notion-style Board & Frontmatter APIs
  getBoardDocuments: (params?: {
    search?: string
    sort?: 'latest' | 'name' | 'score'
    status?: string
    category?: string
    tag?: string
    includeArchived?: boolean
  }) => Promise<ConversionRecord[]>
  updateFrontmatter: (
    slug: string,
    updates: Record<string, any>
  ) => Promise<ConversionRecord | null>
  createDocument: (params: {
    title?: string
    category?: string
    tags?: string[]
    content?: string
  }) => Promise<ConversionRecord>
  duplicateDocument: (slug: string) => Promise<ConversionRecord | null>
  archiveDocument: (slug: string, isArchived: boolean) => Promise<ConversionRecord | null>
  rebuildIndex: () => Promise<{ indexedCount: number; errors: string[] }>
  batchUpdateDocuments: (
    slugs: string[],
    operations: {
      status?: string
      addTag?: string
      removeTag?: string
      category?: string
      delete?: boolean
    }
  ) => Promise<{ successCount: number; errors: string[] }>
  onLibraryChanged: (callback: (event: any) => void) => () => void

  // Phase 8-(가): Groups & Smart Groups APIs
  getAreas: () => Promise<any[]>
  addArea: (name: string) => Promise<any[]>
  addProject: (areaId: string, projectName: string) => Promise<any[]>
  deleteAreaOrProject: (id: string) => Promise<any[]>
  assignDocumentToGroup: (slug: string, groupPath: string, replace?: boolean) => Promise<any>
  getSmartGroups: () => Promise<any[]>
  saveSmartGroup: (group: { name: string; query: string; icon?: string }) => Promise<any[]>
  deleteSmartGroup: (id: string) => Promise<any[]>
  toggleStarDocument: (id: number) => Promise<any>

  // Phase 8-(나): Wiki Links & Backlinks & Highlights
  getBacklinks: (targetTitle: string, targetSlug: string) => Promise<any[]>
  renameWikiReferences: (oldTitle: string, newTitle: string) => Promise<{ updatedFilesCount: number }>
  addHighlight: (filePath: string, selectedText: string) => Promise<{ success: boolean; markdown?: string; error?: string }>
  addFootnoteNote: (filePath: string, selectedText: string, noteText: string) => Promise<{ success: boolean; markdown?: string; error?: string }>
  getAllHighlights: () => Promise<any[]>

  // Phase 8-(다): AI Recommendations & Duplicate Detection
  getAiRecommendations: (text: string, slug?: string) => Promise<{
    suggestedGroup: string | null
    groupConfidence: number
    suggestedTags: string[]
    isDuplicate: boolean
    duplicateMatch: { slug: string; title: string; score: number } | null
    relatedDocuments: { slug: string; title: string; score: number; snippet: string; groups?: string[] }[]
  }>

  // Phase 8-(라): Templates & Quick Capture
  getTemplates: () => Promise<any[]>
  saveTemplate: (template: any) => Promise<any[]>
  createDocumentFromTemplate: (templateId: string, customTitle?: string) => Promise<any>
  quickCaptureNote: (title: string, body: string, tags?: string[]) => Promise<any>

  // Phase 9: Settings & Logs
  openLogFolder: () => Promise<string>
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
  convertDocument: (
    filePath: string,
    libraryDir?: string,
    profile?: string,
    llmConfig?: any,
    sourceLocation?: string
  ) => ipcRenderer.invoke('engine:convert', filePath, libraryDir, profile, llmConfig, sourceLocation),
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
  getOriginalFileUrl: (filePath: string) => ipcRenderer.invoke('library:read-original-file-url', filePath),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (updates: any) => ipcRenderer.invoke('settings:save', updates),
  testGitHubConnection: (params) => ipcRenderer.invoke('settings:test-github', params),
  pickObsidianVault: () => ipcRenderer.invoke('settings:pick-obsidian-vault'),
  pickLibraryFolder: () => ipcRenderer.invoke('settings:pick-library-folder'),
  exportDocuments: (params) => ipcRenderer.invoke('export:documents', params),
  detectCloudProviders: () => ipcRenderer.invoke('cloud:detect-providers'),
  listCloudFiles: (folderPath: string) => ipcRenderer.invoke('cloud:list-files', folderPath),
  pickCloudFolder: () => ipcRenderer.invoke('cloud:pick-folder'),
  exportToCloudDestination: (params) => ipcRenderer.invoke('cloud:export-destination', params),
  reloadWatchFolders: () => ipcRenderer.invoke('watch:reload'),
  onWatchFileDetected: (callback: (fileEvent: any) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, event: any) => callback(event)
    ipcRenderer.on('watch:file-detected', subscription)
    return () => {
      ipcRenderer.removeListener('watch:file-detected', subscription)
    }
  },

  // Phase 7: Board methods
  getBoardDocuments: (params) => ipcRenderer.invoke('board:get-documents', params),
  updateFrontmatter: (slug, updates) => ipcRenderer.invoke('board:update-frontmatter', slug, updates),
  createDocument: (params) => ipcRenderer.invoke('board:create-document', params),
  duplicateDocument: (slug) => ipcRenderer.invoke('board:duplicate-document', slug),
  archiveDocument: (slug, isArchived) => ipcRenderer.invoke('board:archive-document', slug, isArchived),
  rebuildIndex: () => ipcRenderer.invoke('board:rebuild-index'),
  batchUpdateDocuments: (slugs, operations) => ipcRenderer.invoke('board:batch-update', slugs, operations),
  onLibraryChanged: (callback: (event: any) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, event: any) => callback(event)
    ipcRenderer.on('library:external-changed', subscription)
    return () => {
      ipcRenderer.removeListener('library:external-changed', subscription)
    }
  },

  // Phase 8-(가): Groups & Smart Groups methods
  getAreas: () => ipcRenderer.invoke('group:get-areas'),
  addArea: (name) => ipcRenderer.invoke('group:add-area', name),
  addProject: (areaId, projectName) => ipcRenderer.invoke('group:add-project', areaId, projectName),
  deleteAreaOrProject: (id) => ipcRenderer.invoke('group:delete-area-or-project', id),
  assignDocumentToGroup: (slug, groupPath, replace) =>
    ipcRenderer.invoke('group:assign-document', slug, groupPath, replace),
  getSmartGroups: () => ipcRenderer.invoke('smart-group:get-all'),
  saveSmartGroup: (group) => ipcRenderer.invoke('smart-group:save', group),
  deleteSmartGroup: (id) => ipcRenderer.invoke('smart-group:delete', id),
  toggleStarDocument: (id) => ipcRenderer.invoke('doc:toggle-star', id),

  // Phase 8-(나): Wiki Links & Backlinks & Highlights methods
  getBacklinks: (targetTitle, targetSlug) => ipcRenderer.invoke('wiki:get-backlinks', targetTitle, targetSlug),
  renameWikiReferences: (oldTitle, newTitle) =>
    ipcRenderer.invoke('wiki:rename-references', oldTitle, newTitle),
  addHighlight: (filePath, selectedText) => ipcRenderer.invoke('wiki:add-highlight', filePath, selectedText),
  addFootnoteNote: (filePath, selectedText, noteText) =>
    ipcRenderer.invoke('wiki:add-note', filePath, selectedText, noteText),
  getAllHighlights: () => ipcRenderer.invoke('wiki:get-all-highlights'),

  // Phase 8-(다): AI Recommendations & Duplicate Detection
  getAiRecommendations: (text, slug) => ipcRenderer.invoke('ai:get-recommendations', text, slug),

  // Phase 8-(라): Templates & Quick Capture methods
  getTemplates: () => ipcRenderer.invoke('template:get-all'),
  saveTemplate: (template) => ipcRenderer.invoke('template:save', template),
  createDocumentFromTemplate: (templateId, customTitle) =>
    ipcRenderer.invoke('template:create-doc', templateId, customTitle),
  quickCaptureNote: (title, body, tags) =>
    ipcRenderer.invoke('quick-capture:save', title, body, tags),

  // Phase 9: Settings & Logs
  openLogFolder: () => ipcRenderer.invoke('logger:open-folder')
}

try {
  contextBridge.exposeInMainWorld('markflowApi', api)
} catch (error) {
  console.error('[Preload] Failed to expose markflowApi:', error)
}
