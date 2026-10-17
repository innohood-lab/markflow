import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import matter from 'gray-matter'

// Mock db to decouple unit tests from native SQLite bindings in Node environment
const mockDbConversions: Map<string, any> = new Map()

vi.mock('../src/main/db', () => ({
  getDatabase: vi.fn(),
  getSetting: vi.fn().mockReturnValue(null),
  setSetting: vi.fn(),
  updateConversion: vi.fn().mockImplementation((id: number, updates: any) => {
    for (const [slug, item] of mockDbConversions.entries()) {
      if (item.id === id) {
        const merged = { ...item, ...updates }
        mockDbConversions.set(slug, merged)
        return merged
      }
    }
    return null
  }),
  saveConversion: vi.fn().mockImplementation((rec: any) => {
    const item = { ...rec, id: rec.id || Math.floor(Math.random() * 10000) }
    mockDbConversions.set(rec.slug, item)
    return item
  }),
  getConversionBySlug: vi.fn().mockImplementation((slug: string) => {
    return mockDbConversions.get(slug) || null
  }),
  getConversionById: vi.fn().mockImplementation((id: number) => {
    for (const item of mockDbConversions.values()) {
      if (item.id === id) return item
    }
    return null
  }),
  deleteConversion: vi.fn().mockImplementation((id: number) => {
    for (const [slug, item] of mockDbConversions.entries()) {
      if (item.id === id) {
        mockDbConversions.delete(slug)
        return item
      }
    }
    return null
  }),
  getConversions: vi.fn().mockImplementation(() => Array.from(mockDbConversions.values()))
}))

import {
  readDocumentFile,
  updateDocumentFrontmatter,
  createNewDocument,
  duplicateDocument,
  archiveDocument,
  rebuildLibraryIndex,
  batchUpdateDocuments
} from '../src/main/services/documentService'

describe('Phase 7: Notion-style Board & Frontmatter Unit Tests', () => {
  let tempLibraryDir: string

  beforeEach(() => {
    tempLibraryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-board-test-'))
    mockDbConversions.clear()
  })

  afterEach(() => {
    try {
      fs.rmSync(tempLibraryDir, { recursive: true, force: true })
    } catch {}
  })

  describe('Frontmatter Read & Write Integrity Tests', () => {
    it('should perform lossless round-trip update on markdown frontmatter with Korean and special characters', () => {
      const slug = 'korean-complex-doc'
      const filePath = path.join(tempLibraryDir, `${slug}.md`)

      const initialContent = `---
title: "한글 제목 & 특수문자 (!@#$%^&*): 2026 보고서"
status: "inbox"
category: "기획서"
tags: ["보고서", "인공지능", "AX-추진"]
groups: ["업무/기획", "프로젝트/Argos"]
priority: "high"
author: "홍길동"
source_file: "복합문서.docx"
source_type: "docx"
converted_at: "2026-10-17T22:00:00"
quality_score: 95
exported: { github: false, obsidian: false }
---

# 1. 서론 (Introduction)

본 문서는 **한글 유니코드** 및 다양한 *특수문자*가 포함된 테스트 문서입니다.

- 줄바꿈 테스트
- 따옴표: '작은따옴표', "큰따옴표"
- 수식 기호: < > & = + - / %

![샘플차트](assets/korean-complex-doc/chart.png)
`
      fs.writeFileSync(filePath, initialContent, 'utf-8')

      // 1. Initial read verification
      const parsed = readDocumentFile(filePath)
      expect(parsed).not.toBeNull()
      expect(parsed?.title).toBe('한글 제목 & 특수문자 (!@#$%^&*): 2026 보고서')
      expect(parsed?.status).toBe('inbox')
      expect(parsed?.category).toBe('기획서')
      expect(parsed?.tags).toEqual(['보고서', '인공지능', 'AX-추진'])
      expect(parsed?.first_image).toBe('assets/korean-complex-doc/chart.png')
      expect(parsed?.data.priority).toBe('high')
      expect(parsed?.data.author).toBe('홍길동')

      // Register in mock DB
      mockDbConversions.set(slug, {
        id: 101,
        slug,
        title: parsed!.title,
        status: parsed!.status,
        library_path: filePath,
        category: parsed!.category,
        tags: parsed!.tags
      })

      // 2. Update Frontmatter: change status to "ready" (Kanban drag simulation) and add a tag
      const updated = updateDocumentFrontmatter(
        slug,
        {
          status: 'ready',
          tags: [...parsed!.tags, '검토완료']
        },
        filePath
      )

      expect(updated).not.toBeNull()
      expect(updated?.status).toBe('ready')

      // 3. Read raw file from disk to verify disk persistence
      const rawAfter = fs.readFileSync(filePath, 'utf-8')
      const reParsed = matter(rawAfter)

      expect(reParsed.data.status).toBe('ready')
      expect(reParsed.data.tags).toContain('검토완료')
      expect(reParsed.data.tags).toContain('보고서')
      // Custom fields MUST be preserved
      expect(reParsed.data.priority).toBe('high')
      expect(reParsed.data.author).toBe('홍길동')
      expect(reParsed.data.groups).toEqual(['업무/기획', '프로젝트/Argos'])
      expect(reParsed.data.title).toBe('한글 제목 & 특수문자 (!@#$%^&*): 2026 보고서')

      // Markdown body must remain intact
      expect(reParsed.content).toContain('# 1. 서론 (Introduction)')
      expect(reParsed.content).toContain('![샘플차트](assets/korean-complex-doc/chart.png)')
    })
  })

  describe('Document CRUD & Lifecycle Tests', () => {
    it('should create a new blank document with proper Frontmatter template', () => {
      const created = createNewDocument({
        title: '신규 기획안',
        category: '기획서',
        tags: ['신규', '아이디어'],
        libraryDir: tempLibraryDir
      })

      expect(created).toBeDefined()
      expect(created.title).toBe('신규 기획안')
      expect(created.status).toBe('inbox')
      expect(created.category).toBe('기획서')
      expect(created.tags).toEqual(['신규', '아이디어'])

      expect(fs.existsSync(created.library_path)).toBe(true)
      const content = fs.readFileSync(created.library_path, 'utf-8')
      const parsed = matter(content)
      expect(parsed.data.title).toBe('신규 기획안')
      expect(parsed.data.category).toBe('기획서')
      expect(parsed.data.tags).toEqual(['신규', '아이디어'])
    })

    it('should duplicate an existing document and clone its assets', () => {
      // Setup original document and asset
      const origSlug = 'orig-doc'
      const origPath = path.join(tempLibraryDir, `${origSlug}.md`)
      const assetDir = path.join(tempLibraryDir, 'assets', origSlug)
      fs.mkdirSync(assetDir, { recursive: true })
      fs.writeFileSync(path.join(assetDir, 'pic.png'), 'MOCK_IMAGE_BYTES')

      fs.writeFileSync(
        origPath,
        `---
title: "원본 문서"
status: "inbox"
---
# 원본
![사진](assets/orig-doc/pic.png)
`,
        'utf-8'
      )

      mockDbConversions.set(origSlug, {
        id: 202,
        slug: origSlug,
        title: '원본 문서',
        library_path: origPath
      })

      // Duplicate
      const duplicated = duplicateDocument(origSlug, tempLibraryDir)
      expect(duplicated).not.toBeNull()
      expect(duplicated?.title).toBe('원본 문서 (사본)')
      expect(duplicated?.slug).toContain('orig-doc-copy')

      // Verify duplicated file exists on disk
      expect(fs.existsSync(duplicated!.library_path)).toBe(true)
      const dupContent = fs.readFileSync(duplicated!.library_path, 'utf-8')
      const parsedDup = matter(dupContent)
      expect(parsedDup.data.title).toBe('원본 문서 (사본)')
      expect(parsedDup.content).toContain(`assets/${duplicated!.slug}/pic.png`)

      // Verify cloned asset exists
      const clonedAssetPath = path.join(tempLibraryDir, 'assets', duplicated!.slug, 'pic.png')
      expect(fs.existsSync(clonedAssetPath)).toBe(true)
      expect(fs.readFileSync(clonedAssetPath, 'utf-8')).toBe('MOCK_IMAGE_BYTES')
    })

    it('should archive and unarchive documents cleanly', () => {
      const slug = 'archive-target'
      const filePath = path.join(tempLibraryDir, `${slug}.md`)
      fs.writeFileSync(
        filePath,
        `---
title: "보관 대상 문서"
status: "inbox"
---
# 내용
`,
        'utf-8'
      )

      mockDbConversions.set(slug, {
        id: 303,
        slug,
        title: '보관 대상 문서',
        library_path: filePath,
        status: 'inbox'
      })

      // 1. Archive
      const archived = archiveDocument(slug, true)
      expect(archived?.status).toBe('archived')
      const contentArchived = fs.readFileSync(filePath, 'utf-8')
      const parsedArchived = matter(contentArchived)
      expect(parsedArchived.data.status).toBe('archived')

      // 2. Unarchive
      const unarchived = archiveDocument(slug, false)
      expect(unarchived?.status).toBe('inbox')
      const contentUnarchived = fs.readFileSync(filePath, 'utf-8')
      const parsedUnarchived = matter(contentUnarchived)
      expect(parsedUnarchived.data.status).toBe('inbox')
    })
  })

  describe('Index Rebuild & Batch Operations Tests', () => {
    it('should rebuild library index from markdown files on disk', () => {
      // Create 3 markdown files in temp library directory
      for (let i = 1; i <= 3; i++) {
        const p = path.join(tempLibraryDir, `doc-${i}.md`)
        fs.writeFileSync(
          p,
          `---
title: "문서 ${i}"
status: "inbox"
category: "분류${i}"
tags: ["tag${i}"]
quality_score: ${80 + i}
---
# 문서 ${i}
본문 내용 ${i}
`,
          'utf-8'
        )
      }

      // Create an asset folder and hidden history file to test filtering
      const historyDir = path.join(tempLibraryDir, '.history')
      fs.mkdirSync(historyDir, { recursive: true })
      fs.writeFileSync(path.join(historyDir, 'old.md'), 'HISTORY')

      const result = rebuildLibraryIndex(tempLibraryDir)
      expect(result.indexedCount).toBe(3)
      expect(result.errors.length).toBe(0)
      expect(mockDbConversions.size).toBe(3)
      expect(mockDbConversions.has('doc-1')).toBe(true)
      expect(mockDbConversions.has('doc-2')).toBe(true)
      expect(mockDbConversions.has('doc-3')).toBe(true)
    })

    it('should batch update document status and tags across multiple files', () => {
      const slugA = 'batch-a'
      const slugB = 'batch-b'
      const pathA = path.join(tempLibraryDir, `${slugA}.md`)
      const pathB = path.join(tempLibraryDir, `${slugB}.md`)

      fs.writeFileSync(pathA, `---\ntitle: "A"\nstatus: "inbox"\ntags: ["공통"]\n---\n# A\n`, 'utf-8')
      fs.writeFileSync(pathB, `---\ntitle: "B"\nstatus: "inbox"\ntags: ["공통"]\n---\n# B\n`, 'utf-8')

      mockDbConversions.set(slugA, { id: 401, slug: slugA, title: 'A', library_path: pathA, tags: ['공통'] })
      mockDbConversions.set(slugB, { id: 402, slug: slugB, title: 'B', library_path: pathB, tags: ['공통'] })

      const res = batchUpdateDocuments([slugA, slugB], {
        status: 'ready',
        addTag: '2026-완료'
      })

      expect(res.successCount).toBe(2)

      const contentA = fs.readFileSync(pathA, 'utf-8')
      const contentB = fs.readFileSync(pathB, 'utf-8')

      const parsedA = matter(contentA)
      const parsedB = matter(contentB)

      expect(parsedA.data.status).toBe('ready')
      expect(parsedA.data.tags).toContain('2026-완료')
      expect(parsedB.data.status).toBe('ready')
      expect(parsedB.data.tags).toContain('2026-완료')
    })
  })
})
