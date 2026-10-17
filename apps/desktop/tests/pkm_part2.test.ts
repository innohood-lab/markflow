import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  extractWikiLinks,
  findBacklinks,
  renameWikiLinkReferences,
  addHighlightToDocument,
  addFootnoteNoteToDocument,
  getAllHighlights
} from '../src/main/services/wikiLinkService'

describe('Phase 8-(나): Wiki Links & Backlinks & Highlights Service', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-wiki-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('extractWikiLinks', () => {
    it('should extract simple wiki links and aliased wiki links', () => {
      const markdown = `
# Sample Doc
Here is a link to [[Project Alpha]] and another link to [[AI Research|인공지능 연구]].
Also an empty link [[]] should be ignored.
      `
      const links = extractWikiLinks(markdown)
      expect(links).toEqual(['Project Alpha', 'AI Research'])
    })

    it('should return empty array for empty markdown or no links', () => {
      expect(extractWikiLinks('')).toEqual([])
      expect(extractWikiLinks('Just plain text with no links.')).toEqual([])
    })
  })

  describe('findBacklinks', () => {
    it('should detect backlinks pointing to a document title or slug', () => {
      // Create Document A (Target)
      const docAPath = path.join(tempDir, 'doc-a.md')
      fs.writeFileSync(
        docAPath,
        `---\ntitle: "Deep Learning Foundations"\n---\n# Content of Doc A`,
        'utf-8'
      )

      // Create Document B (Referencing Doc A via title)
      const docBPath = path.join(tempDir, 'doc-b.md')
      fs.writeFileSync(
        docBPath,
        `---\ntitle: "Machine Learning Roadmap"\n---\nCheck out [[Deep Learning Foundations]] for basics.`,
        'utf-8'
      )

      // Create Document C (Referencing Doc A via alias)
      const docCPath = path.join(tempDir, 'doc-c.md')
      fs.writeFileSync(
        docCPath,
        `---\ntitle: "Study Notes"\n---\nSee [[Deep Learning Foundations|DL 기초]] before starting.`,
        'utf-8'
      )

      // Create Document D (Unrelated)
      const docDPath = path.join(tempDir, 'doc-d.md')
      fs.writeFileSync(
        docDPath,
        `---\ntitle: "Unrelated Note"\n---\nNothing here.`,
        'utf-8'
      )

      const backlinks = findBacklinks('Deep Learning Foundations', 'doc-a', tempDir)
      expect(backlinks).toHaveLength(2)

      const sourceTitles = backlinks.map((b) => b.sourceTitle)
      expect(sourceTitles).toContain('Machine Learning Roadmap')
      expect(sourceTitles).toContain('Study Notes')

      const bMatch = backlinks.find((b) => b.sourceSlug === 'doc-b')
      expect(bMatch?.snippet).toContain('[[Deep Learning Foundations]]')
    })

    it('should skip self-links', () => {
      const docAPath = path.join(tempDir, 'doc-a.md')
      fs.writeFileSync(
        docAPath,
        `---\ntitle: "Self Linking Doc"\n---\n[[Self Linking Doc]]`,
        'utf-8'
      )

      const backlinks = findBacklinks('Self Linking Doc', 'doc-a', tempDir)
      expect(backlinks).toHaveLength(0)
    })
  })

  describe('renameWikiLinkReferences', () => {
    it('should safely rename wiki links and preserve aliases across documents', () => {
      const doc1 = path.join(tempDir, 'note1.md')
      fs.writeFileSync(
        doc1,
        `Reference to [[Old Title]] here and another [[Old Title|Old Alias]].`,
        'utf-8'
      )

      const doc2 = path.join(tempDir, 'note2.md')
      fs.writeFileSync(
        doc2,
        `Unrelated link to [[Other Note]].`,
        'utf-8'
      )

      const res = renameWikiLinkReferences('Old Title', 'New Title', tempDir)
      expect(res.updatedFilesCount).toBe(1)

      const updatedDoc1 = fs.readFileSync(doc1, 'utf-8')
      expect(updatedDoc1).toContain('[[New Title]]')
      expect(updatedDoc1).toContain('[[New Title|Old Alias]]')
      expect(updatedDoc1).not.toContain('[[Old Title]]')

      const updatedDoc2 = fs.readFileSync(doc2, 'utf-8')
      expect(updatedDoc2).toBe(`Unrelated link to [[Other Note]].`)
    })
  })

  describe('addHighlightToDocument', () => {
    it('should wrap selected text with ==highlight== syntax', () => {
      const testFile = path.join(tempDir, 'highlight-test.md')
      fs.writeFileSync(testFile, `# Title\n\nThis is important knowledge to remember.\n`, 'utf-8')

      const res = addHighlightToDocument(testFile, 'important knowledge')
      expect(res.success).toBe(true)
      expect(res.markdown).toContain('==important knowledge==')

      const onDisk = fs.readFileSync(testFile, 'utf-8')
      expect(onDisk).toContain('==important knowledge==')
    })

    it('should handle already highlighted text idempotently', () => {
      const testFile = path.join(tempDir, 'already-highlighted.md')
      fs.writeFileSync(testFile, `# Title\n\nThis is ==important== text.\n`, 'utf-8')

      const res = addHighlightToDocument(testFile, 'important')
      expect(res.success).toBe(true)
      const onDisk = fs.readFileSync(testFile, 'utf-8')
      expect(onDisk).toBe(`# Title\n\nThis is ==important== text.\n`)
    })
  })

  describe('addFootnoteNoteToDocument', () => {
    it('should append footnote marker and definition to markdown', () => {
      const testFile = path.join(tempDir, 'note-test.md')
      fs.writeFileSync(testFile, `# Title\n\nThis statement requires further verification.\n`, 'utf-8')

      const res = addFootnoteNoteToDocument(
        testFile,
        'further verification',
        'Check 2026 Q3 official report.'
      )
      expect(res.success).toBe(true)
      expect(res.markdown).toMatch(/further verification\[\^note-[a-z0-9]+\]/)
      expect(res.markdown).toMatch(/\[\^note-[a-z0-9]+\]: Check 2026 Q3 official report\./)

      const onDisk = fs.readFileSync(testFile, 'utf-8')
      expect(onDisk).toBe(res.markdown)
    })
  })

  describe('getAllHighlights', () => {
    it('should scan and collect all highlights and notes across library', () => {
      const doc1 = path.join(tempDir, 'doc1.md')
      fs.writeFileSync(
        doc1,
        `---\ntitle: "Doc 1"\n---\nKey sentence: ==critical finding==.\n\n[^note-1]: First comment`,
        'utf-8'
      )

      const doc2 = path.join(tempDir, 'doc2.md')
      fs.writeFileSync(
        doc2,
        `---\ntitle: "Doc 2"\n---\nAnother ==vital point== here.`,
        'utf-8'
      )

      const all = getAllHighlights(tempDir)
      expect(all).toHaveLength(3)

      const highlights = all.filter((i) => i.type === 'highlight')
      expect(highlights).toHaveLength(2)
      expect(highlights.map((h) => h.text)).toContain('critical finding')
      expect(highlights.map((h) => h.text)).toContain('vital point')

      const notes = all.filter((i) => i.type === 'note')
      expect(notes).toHaveLength(1)
      expect(notes[0].note).toBe('First comment')
    })
  })
})
