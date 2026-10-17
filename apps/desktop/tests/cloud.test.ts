import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock db to decouple unit tests from native SQLite bindings in Node environment
vi.mock('../src/main/db', () => ({
  getDatabase: vi.fn(),
  getSetting: vi.fn().mockReturnValue(null),
  setSetting: vi.fn(),
  updateConversion: vi.fn(),
  logExport: vi.fn(),
  getExportLogs: vi.fn().mockReturnValue([]),
  findConversionByHash: vi.fn().mockReturnValue(null)
}))

import { LocalFolderAdapter, SUPPORTED_EXTS } from '../src/main/services/storageAdapter'
import { detectCloudStorageFolders } from '../src/main/services/cloudDetector'
import { WatchFolderService } from '../src/main/services/watchFolderService'
import { exportDocumentsToCloudDestination } from '../src/main/services/settingsService'

describe('Phase 6: Cloud Storage & Watch Folders Unit Tests', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-cloud-test-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  describe('LocalFolderAdapter Tests', () => {
    it('should list directory entries, detect supported files and sort directories first', async () => {
      // Setup test files and subfolder
      const subfolder = path.join(tempDir, 'SubFolder')
      fs.mkdirSync(subfolder)

      fs.writeFileSync(path.join(tempDir, 'document.docx'), 'DOCX_CONTENT')
      fs.writeFileSync(path.join(tempDir, 'notes.txt'), 'TEXT_CONTENT')
      fs.writeFileSync(path.join(tempDir, 'unsupported.xyz'), 'OTHER_CONTENT')
      fs.writeFileSync(path.join(tempDir, '.hidden_ignore'), 'HIDDEN')

      const adapter = new LocalFolderAdapter('TestFolder', tempDir)
      const items = await adapter.list()

      // SubFolder should be first
      expect(items.length).toBe(4) // subFolder, document.docx, notes.txt, unsupported.xyz (.hidden_ignore excluded)
      expect(items[0].isDirectory).toBe(true)
      expect(items[0].name).toBe('SubFolder')

      // Files
      const docxItem = items.find((i) => i.name === 'document.docx')
      expect(docxItem).toBeDefined()
      expect(docxItem?.isSupported).toBe(true)
      expect(docxItem?.sourceType).toBe('docx')
      expect(docxItem?.size).toBe('DOCX_CONTENT'.length)

      const xyzItem = items.find((i) => i.name === 'unsupported.xyz')
      expect(xyzItem).toBeDefined()
      expect(xyzItem?.isSupported).toBe(false)
    })

    it('should detect iCloud / cloud on-demand placeholder files and normalize name', async () => {
      // Create .sample_report.pdf.icloud
      const placeholderPath = path.join(tempDir, '.sample_report.pdf.icloud')
      fs.writeFileSync(placeholderPath, 'ICLOUD_STUB_METADATA')

      const adapter = new LocalFolderAdapter('iCloud', tempDir)
      const items = await adapter.list()

      expect(items.length).toBe(1)
      const item = items[0]
      expect(item.name).toBe('sample_report.pdf')
      expect(item.isPlaceholder).toBe(true)
      expect(item.isDirectory).toBe(false)
      expect(item.isSupported).toBe(true)
      expect(item.sourceType).toBe('pdf')
    })

    it('should throw helpful error when reading an online placeholder file', async () => {
      const placeholderPath = path.join(tempDir, '.large_archive.zip.icloud')
      fs.writeFileSync(placeholderPath, 'ICLOUD_STUB')

      const adapter = new LocalFolderAdapter('iCloud', tempDir)
      const destPath = path.join(tempDir, 'downloaded.zip')

      await expect(adapter.read(placeholderPath, destPath)).rejects.toThrow(
        /온라인 전용 파일\(large_archive\.zip\)입니다/
      )
    })

    it('should safely read, write, and check existence of files', async () => {
      const adapter = new LocalFolderAdapter('Local', tempDir)
      const testFile = path.join(tempDir, 'output.md')

      expect(await adapter.exists(testFile)).toBe(false)
      await adapter.write(testFile, '# Hello World\nContent here')
      expect(await adapter.exists(testFile)).toBe(true)

      const copyDest = path.join(tempDir, 'copied.md')
      await adapter.read(testFile, copyDest)
      expect(fs.readFileSync(copyDest, 'utf-8')).toBe('# Hello World\nContent here')
    })
  })

  describe('Cloud Storage Detector Tests', () => {
    it('should detect custom registered folders cleanly', () => {
      const customFolder = path.join(tempDir, 'MyCustomTeamFolder')
      fs.mkdirSync(customFolder)

      const customFolders = [
        { id: 'custom-team', name: 'Team Sync', path: customFolder },
        { id: 'custom-nonexistent', name: 'Missing', path: path.join(tempDir, 'not_there') }
      ]

      const detected = detectCloudStorageFolders(customFolders)
      const teamItem = detected.find((d) => d.id === 'custom-team')

      expect(teamItem).toBeDefined()
      expect(teamItem?.provider).toBe('custom')
      expect(teamItem?.name).toBe('Team Sync')
      expect(teamItem?.path).toBe(customFolder)
      expect(teamItem?.isAvailable).toBe(true)

      // Nonexistent folder should be filtered out
      const missingItem = detected.find((d) => d.id === 'custom-nonexistent')
      expect(missingItem).toBeUndefined()
    })
  })

  describe('WatchFolderService Tests', () => {
    it('should compute consistent SHA-256 hashes for files', () => {
      const service = new WatchFolderService(100)
      const testFilePath = path.join(tempDir, 'sample_hash.txt')
      fs.writeFileSync(testFilePath, 'MarkFlow Content for SHA256')

      const hash1 = service.computeFileHash(testFilePath)
      const hash2 = service.computeFileHash(testFilePath)

      expect(hash1).toBe(hash2)
      expect(hash1.length).toBe(64) // sha256 hex string length
    })

    it('should manage watch folder paths add/remove properly', () => {
      const service = new WatchFolderService(100)
      const folderA = path.join(tempDir, 'WatchA')
      const folderB = path.join(tempDir, 'WatchB')
      fs.mkdirSync(folderA)
      fs.mkdirSync(folderB)

      service.addFolder(folderA)
      expect(service.getWatchedFolders()).toContain(path.resolve(folderA))

      service.addFolder(folderB)
      expect(service.getWatchedFolders().length).toBe(2)

      service.removeFolder(folderA)
      expect(service.getWatchedFolders()).not.toContain(path.resolve(folderA))
      expect(service.getWatchedFolders()).toContain(path.resolve(folderB))

      service.stop()
      expect(service.getWatchedFolders().length).toBe(0)
    })
  })

  describe('Cloud Destination Export Tests', () => {
    it('should export documents with flat MarkFlow/ folder rule and copy assets', async () => {
      // 1. Prepare target destination folder
      const destDir = path.join(tempDir, 'CloudDestination')
      fs.mkdirSync(destDir)

      // 2. Prepare mock library document and asset
      const libraryDir = path.join(tempDir, 'Library')
      const assetsDir = path.join(libraryDir, 'assets', 'cloud-doc')
      fs.mkdirSync(assetsDir, { recursive: true })

      const mockAsset = path.join(assetsDir, 'chart.png')
      fs.writeFileSync(mockAsset, 'PNG_DATA')

      const mockMd = path.join(libraryDir, 'cloud-doc.md')
      fs.writeFileSync(mockMd, '# Cloud Document\n![Chart](assets/cloud-doc/chart.png)', 'utf-8')

      const mockDoc: any = {
        id: 777,
        slug: 'cloud-doc',
        title: '클라우드 문서',
        library_path: mockMd,
        status: 'inbox',
        exported_json: '{}'
      }

      const destination: any = {
        id: 'dest-gdrive',
        provider: 'gdrive',
        name: 'Google Drive Sync',
        targetPath: destDir,
        folderRule: 'flat'
      }

      const result = await exportDocumentsToCloudDestination([mockDoc], destination)

      expect(result.success).toBe(true)
      expect(result.exportedCount).toBe(1)

      // Verify file was saved in targetPath/MarkFlow/cloud-doc.md
      const expectedMd = path.join(destDir, 'MarkFlow', 'cloud-doc.md')
      expect(fs.existsSync(expectedMd)).toBe(true)
      expect(fs.readFileSync(expectedMd, 'utf-8')).toBe(
        '# Cloud Document\n![Chart](assets/cloud-doc/chart.png)'
      )

      // Verify asset was copied
      const expectedAsset = path.join(destDir, 'MarkFlow', 'assets', 'cloud-doc', 'chart.png')
      expect(fs.existsSync(expectedAsset)).toBe(true)
      expect(fs.readFileSync(expectedAsset, 'utf-8')).toBe('PNG_DATA')
    })

    it('should export documents with date-based MarkFlow/YYYY/MM/ folder rule', async () => {
      const destDir = path.join(tempDir, 'DateDestination')
      fs.mkdirSync(destDir)

      const libraryDir = path.join(tempDir, 'Library')
      fs.mkdirSync(libraryDir, { recursive: true })

      const mockMd = path.join(libraryDir, 'dated-doc.md')
      fs.writeFileSync(mockMd, '# Dated Document', 'utf-8')

      const mockDoc: any = {
        id: 778,
        slug: 'dated-doc',
        title: '날짜별 문서',
        library_path: mockMd,
        status: 'inbox',
        exported_json: '{}'
      }

      const destination: any = {
        id: 'dest-onedrive',
        provider: 'onedrive',
        name: 'OneDrive Personal',
        targetPath: destDir,
        folderRule: 'date'
      }

      const result = await exportDocumentsToCloudDestination([mockDoc], destination)

      expect(result.success).toBe(true)
      expect(result.exportedCount).toBe(1)

      const now = new Date()
      const year = String(now.getFullYear())
      const month = String(now.getMonth() + 1).padStart(2, '0')

      const expectedMd = path.join(destDir, 'MarkFlow', year, month, 'dated-doc.md')
      expect(fs.existsSync(expectedMd)).toBe(true)
      expect(fs.readFileSync(expectedMd, 'utf-8')).toBe('# Dated Document')
    })
  })
})
