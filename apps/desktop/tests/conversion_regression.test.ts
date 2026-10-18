import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SidecarManager } from '../src/main/sidecar'
import { getRecommendations } from '../src/main/services/aiRecommendationService'
import {
  saveConversion,
  getConversions,
  deleteConversion,
  restoreConversion,
  logExport,
  getExportLogs
} from '../src/main/db'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('Conversion & Sidecar Regression Tests', () => {
  let originalFetch: typeof global.fetch
  let tempDir: string

  beforeEach(() => {
    originalFetch = global.fetch
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-reg-test-'))
  })

  afterEach(() => {
    global.fetch = originalFetch
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  it('SidecarManager.convertDocument should check currentStatus.state without throwing TypeError and send conversion request', async () => {
    const sidecar = new SidecarManager()
    ;(sidecar as any).port = 18523
    ;(sidecar as any).secret = 'test-secret-token'
    ;(sidecar as any).currentStatus = { state: 'ready', port: 18523 }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        slug: '2026-10-18-test-doc',
        title: 'Test Document',
        markdown: '---\ntitle: Test Document\n---\n\n# Hello',
        quality_score: 95
      })
    } as any)

    const result = await sidecar.convertDocument('/tmp/test.docx', tempDir, 'balanced')
    expect(result.status).toBe('success')
    expect(result.slug).toBe('2026-10-18-test-doc')
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:18523/convert',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Engine-Secret': 'test-secret-token'
        })
      })
    )
  })

  it('SidecarManager.convertDocument should wait for ready when status is starting', async () => {
    const sidecar = new SidecarManager()
    ;(sidecar as any).port = 18524
    ;(sidecar as any).currentStatus = { state: 'starting', port: 18524 }

    setTimeout(() => {
      ;(sidecar as any).currentStatus = { state: 'ready', port: 18524 }
    }, 250)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        slug: '2026-10-18-delayed-doc',
        title: 'Delayed Doc'
      })
    } as any)

    const result = await sidecar.convertDocument('/tmp/delayed.pdf', tempDir, 'balanced')
    expect(result.status).toBe('success')
    expect(result.slug).toBe('2026-10-18-delayed-doc')
  })

  it('aiRecommendationService.getRecommendations should construct sidecar URL properly when sidecar is ready', async () => {
    const sidecar = new SidecarManager()
    ;(sidecar as any).port = 18525
    ;(sidecar as any).secret = 'sim-secret'
    ;(sidecar as any).currentStatus = { state: 'ready', port: 18525 }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggested_group: '업무/기획',
        group_confidence: 0.88,
        suggested_tags: ['AI', '기획'],
        is_duplicate: false,
        duplicate_match: null,
        related_documents: []
      })
    } as any)

    const rec = await getRecommendations('AI 플랫폼 아키텍처 기획서 본문', 'test-slug', tempDir, sidecar)
    expect(rec.suggestedGroup).toBe('업무/기획')
    expect(rec.suggestedTags).toEqual(['AI', '기획'])
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:18525/similarity/recommendations',
      expect.objectContaining({
        method: 'POST'
      })
    )
  })

  it('SQLite db fallback should save, query, delete, restore conversions and log exports cleanly', () => {
    const uniqueSlug = `reg-test-${Date.now()}`
    const saved = saveConversion({
      slug: uniqueSlug,
      title: '회귀 테스트 문서',
      source_file: 'sample.docx',
      source_path: '/tmp/sample.docx',
      source_type: 'docx',
      converted_at: new Date().toISOString(),
      library_path: path.join(tempDir, `${uniqueSlug}.md`),
      status: 'inbox',
      quality_score: 92,
      profile: 'balanced',
      markdown: '# 회귀 테스트 문서\n본문 내용입니다.'
    })

    expect(saved.id).toBeDefined()
    const list = getConversions({ search: '회귀 테스트' })
    expect(list.some((item) => item.slug === uniqueSlug)).toBe(true)

    const deleted = deleteConversion(saved.id!)
    expect(deleted?.slug).toBe(uniqueSlug)

    const restored = restoreConversion(saved.id!)
    expect(restored?.is_deleted).toBe(0)

    logExport(saved.id!, 'obsidian', 'success', '/vault/00_Inbox/test.md')
    const logs = getExportLogs(10)
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0].target).toBe('obsidian')
  })

  it('4) 클라우드 드라이브(Google Drive 등) 및 직접 선택한 로컬 폴더 내보내기가 정상 동작해야 한다', async () => {
    const { exportDocumentsToCloudDestination } = await import('../src/main/services/settingsService')

    const srcLibFile = path.join(tempDir, 'cloud-export-doc.md')
    fs.writeFileSync(srcLibFile, '# 클라우드 저장 테스트\n구글 드라이브 및 로컬 폴더 저장 본문입니다.', 'utf-8')

    const docs = [
      {
        slug: 'cloud-export-doc',
        title: '클라우드 저장 테스트',
        library_path: srcLibFile,
        markdown: '# 클라우드 저장 테스트\n구글 드라이브 및 로컬 폴더 저장 본문입니다.'
      }
    ]

    // 4-1. Cloud drive export (creates MarkFlow subfolder)
    const fakeGdriveRoot = path.join(tempDir, 'GoogleDrive-MyDrive')
    fs.mkdirSync(fakeGdriveRoot, { recursive: true })
    const cloudRes = await exportDocumentsToCloudDestination(docs, {
      id: 'gdrive-test',
      provider: 'gdrive',
      name: 'Google Drive (내 드라이브)',
      targetPath: fakeGdriveRoot,
      folderRule: 'flat',
      autoSave: false
    })
    expect(cloudRes.exportedCount).toBe(1)
    expect(fs.existsSync(path.join(fakeGdriveRoot, 'MarkFlow', 'cloud-export-doc.md'))).toBe(true)

    // 4-2. Direct local folder export (saves directly into chosen folder without MarkFlow subfolder)
    const directFolder = path.join(tempDir, 'MyCustomExportFolder')
    fs.mkdirSync(directFolder, { recursive: true })
    const directRes = await exportDocumentsToCloudDestination(
      docs,
      {
        id: 'direct-folder',
        provider: 'local',
        name: 'MyCustomExportFolder',
        targetPath: directFolder,
        folderRule: 'flat',
        autoSave: false
      },
      { directFolder: true }
    )
    expect(directRes.exportedCount).toBe(1)
    expect(fs.existsSync(path.join(directFolder, 'cloud-export-doc.md'))).toBe(true)
  })
})

