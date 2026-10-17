import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import matter from 'gray-matter'
import {
  ensureTemplates,
  saveTemplate,
  createDocumentFromTemplate,
  quickCaptureNote
} from '../src/main/services/templateService'

// Mock db to decouple unit tests from native SQLite bindings in Node environment
const mockDbConversions: Map<string, any> = new Map()

vi.mock('../src/main/db', () => ({
  getDatabase: vi.fn(),
  getSetting: vi.fn().mockReturnValue(null),
  setSetting: vi.fn(),
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
  })
}))

describe('Phase 8-(라): Template System & Quick Capture Service', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-tpl-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('ensureTemplates', () => {
    it('should initialize and return default templates when directory is empty', () => {
      const templates = ensureTemplates(tempDir)
      expect(templates.length).toBeGreaterThanOrEqual(4)

      const ids = templates.map((t) => t.id)
      expect(ids).toContain('meeting')
      expect(ids).toContain('project_spec')
      expect(ids).toContain('tech_review')
      expect(ids).toContain('weekly_review')

      const meetingTpl = templates.find((t) => t.id === 'meeting')
      expect(meetingTpl?.name).toBe('회의록')
      expect(meetingTpl?.body).toContain('회의 개요')
      expect(meetingTpl?.frontmatter.tags).toContain('회의록')
    })
  })

  describe('saveTemplate', () => {
    it('should save a new custom template to .templates/ directory', () => {
      const updated = saveTemplate(tempDir, {
        id: 'book-review',
        name: '독서 리뷰',
        description: '책 핵심 요약 및 인상 깊은 구절 정리',
        icon: 'BookOpen',
        frontmatter: { category: '독서', tags: ['독서', '책'] },
        body: '## 1. 책 소개\n- 저자:\n- 출판사:\n\n## 2. 인상 깊은 구절\n> '
      })

      expect(updated.map((t) => t.id)).toContain('book-review')

      const savedFile = path.join(tempDir, '.templates', 'book-review.md')
      expect(fs.existsSync(savedFile)).toBe(true)

      const raw = fs.readFileSync(savedFile, 'utf-8')
      const parsed = matter(raw)
      expect(parsed.data.name).toBe('독서 리뷰')
      expect(parsed.content).toContain('책 소개')
    })
  })

  describe('createDocumentFromTemplate', () => {
    it('should create a valid markdown document applying template frontmatter and body', () => {
      const result = createDocumentFromTemplate(tempDir, 'meeting', '2026-10-18 디자인 스프린트 회의')
      expect(result.success).toBe(true)
      expect(result.item).toBeDefined()
      expect(result.item.title).toBe('2026-10-18 디자인 스프린트 회의')

      const docFile = path.join(tempDir, `${result.item.slug}.md`)
      expect(fs.existsSync(docFile)).toBe(true)

      const raw = fs.readFileSync(docFile, 'utf-8')
      const parsed = matter(raw)
      expect(parsed.data.title).toBe('2026-10-18 디자인 스프린트 회의')
      expect(parsed.data.category).toBe('회의')
      expect(parsed.data.tags).toContain('회의록')
      expect(parsed.content).toContain('주요 논의 내용')
    })
  })

  describe('quickCaptureNote', () => {
    it('should quickly create a note document in the library with default tags', () => {
      const result = quickCaptureNote(
        tempDir,
        '급한 아이디어 메모',
        'MarkFlow 모바일 동기화 기능 아이디어 메모.',
        ['아이디어', '모바일']
      )

      expect(result.success).toBe(true)
      expect(result.item.title).toBe('급한 아이디어 메모')

      const docFile = path.join(tempDir, `${result.item.slug}.md`)
      expect(fs.existsSync(docFile)).toBe(true)

      const raw = fs.readFileSync(docFile, 'utf-8')
      const parsed = matter(raw)
      expect(parsed.data.tags).toContain('아이디어')
      expect(parsed.content).toContain('MarkFlow 모바일 동기화 기능 아이디어 메모.')
    })
  })
})
