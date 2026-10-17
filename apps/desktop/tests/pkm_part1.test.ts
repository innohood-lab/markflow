import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import matter from 'gray-matter'

const mockSettingsStore: Map<string, string> = new Map()
const mockDbConversions: Map<string, any> = new Map()

vi.mock('../src/main/db', () => ({
  getDatabase: vi.fn(),
  getSetting: vi.fn().mockImplementation((key: string) => mockSettingsStore.get(key) || null),
  setSetting: vi.fn().mockImplementation((key: string, value: string) => {
    mockSettingsStore.set(key, value)
  }),
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
  getConversions: vi.fn().mockImplementation(() => Array.from(mockDbConversions.values()))
}))

import { parseSearchQuery, buildSqlFilterFromQuery } from '../src/main/services/searchQueryParser'
import {
  getAreaHierarchy,
  saveAreaHierarchy,
  addArea,
  addProject,
  deleteAreaOrProject,
  assignDocumentToGroup,
  getSmartGroups,
  saveSmartGroup,
  deleteSmartGroup,
  toggleStarDocument
} from '../src/main/services/smartGroupService'

describe('Phase 8-(가): PKM Groups & Smart Groups Unit Tests', () => {
  let tempLibraryDir: string

  beforeEach(() => {
    tempLibraryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-pkm1-test-'))
    mockSettingsStore.clear()
    mockDbConversions.clear()
  })

  afterEach(() => {
    try {
      fs.rmSync(tempLibraryDir, { recursive: true, force: true })
    } catch {}
  })

  describe('Search Query Parser Tests', () => {
    it('should parse free terms, exact phrases, and negations', () => {
      const q = '인공지능 "2026 사업 계획" -임시'
      const parsed = parseSearchQuery(q)

      expect(parsed.terms).toContain('인공지능')
      expect(parsed.phrases).toContain('2026 사업 계획')
      expect(parsed.negations).toContain('임시')
    })

    it('should parse field queries: tag, type, status, group, score, date, exported', () => {
      const q = 'tag:보고서 type:docx status:준비완료 group:AX score:>=80 date:>2026-09-01 exported:false'
      const parsed = parseSearchQuery(q)

      expect(parsed.tags).toContain('보고서')
      expect(parsed.types).toContain('docx')
      expect(parsed.statuses).toContain('ready') // mapped from 준비완료
      expect(parsed.groups).toContain('AX')
      expect(parsed.scoreComparison).toEqual({ op: '>=', value: 80 })
      expect(parsed.dateComparison).toEqual({ op: '>', value: '2026-09-01' })
      expect(parsed.exportedFilter).toBe(false)
    })

    it('should build SQL WHERE clauses and parameters correctly', () => {
      const q = 'tag:보고서 type:pdf score:<70'
      const parsed = parseSearchQuery(q)
      const { whereClauses, params } = buildSqlFilterFromQuery(parsed)

      expect(whereClauses.some((c) => c.includes('tags_json LIKE'))).toBe(true)
      expect(whereClauses.some((c) => c.includes('LOWER(source_type) IN'))).toBe(true)
      expect(whereClauses.some((c) => c.includes('quality_score <'))).toBe(true)

      expect(params.tag_0).toBe('%"보고서"%')
      expect(params.type_0).toBe('pdf')
      expect(params.score_comp).toBe(70)
    })

    it('should handle OR condition across free terms', () => {
      const q = '기획서 OR 보고서'
      const parsed = parseSearchQuery(q)
      expect(parsed.hasOrCondition).toBe(true)

      const { whereClauses } = buildSqlFilterFromQuery(parsed)
      expect(whereClauses[0]).toContain('OR')
    })
  })

  describe('DEVONthink Group Hierarchy (Area > Project) Tests', () => {
    it('should return default area hierarchy on first run', () => {
      const areas = getAreaHierarchy()
      expect(areas.length).toBeGreaterThanOrEqual(2)
      expect(areas.some((a) => a.name === '업무')).toBe(true)
      expect(areas.some((a) => a.name === '개인')).toBe(true)
    })

    it('should add new area and projects with correct group paths', () => {
      const afterArea = addArea('연구개발')
      const rAndD = afterArea.find((a) => a.name === '연구개발')
      expect(rAndD).toBeDefined()

      const afterProj = addProject(rAndD!.id, '차세대 AI')
      const updatedArea = afterProj.find((a) => a.id === rAndD!.id)
      const proj = updatedArea?.projects.find((p) => p.name === '차세대 AI')

      expect(proj).toBeDefined()
      expect(proj?.groupPath).toBe('연구개발/차세대 AI')
    })

    it('should assign document to project groups without duplicates, and overwrite when replace=true', () => {
      const slug = 'proj-doc'
      const filePath = path.join(tempLibraryDir, `${slug}.md`)
      fs.writeFileSync(
        filePath,
        `---
title: "프로젝트 문서"
status: "inbox"
groups: ["업무/기존프로젝트"]
---
# 본문
`,
        'utf-8'
      )

      mockDbConversions.set(slug, {
        id: 501,
        slug,
        title: '프로젝트 문서',
        library_path: filePath,
        groups: ['업무/기존프로젝트']
      })

      // 1. Append new group (DEVONthink Replicant)
      const updated = assignDocumentToGroup(slug, '업무/AX 추진', false)
      expect(updated).not.toBeNull()

      const contentAfter = fs.readFileSync(filePath, 'utf-8')
      const parsed = matter(contentAfter)
      expect(parsed.data.groups).toContain('업무/기존프로젝트')
      expect(parsed.data.groups).toContain('업무/AX 추진')

      // 2. Overwrite groups when replace=true (Move mode with Alt/Option)
      assignDocumentToGroup(slug, '개인/지식 관리', true)
      const contentReplace = fs.readFileSync(filePath, 'utf-8')
      const parsedReplace = matter(contentReplace)
      expect(parsedReplace.data.groups).toEqual(['개인/지식 관리'])
    })

    it('should delete project or area cleanly', () => {
      const areas = getAreaHierarchy()
      const workArea = areas.find((a) => a.name === '업무')!
      const projId = workArea.projects[0].id

      const afterDelProj = deleteAreaOrProject(projId)
      const updatedWork = afterDelProj.find((a) => a.name === '업무')!
      expect(updatedWork.projects.some((p) => p.id === projId)).toBe(false)
    })
  })

  describe('Smart Groups & Starred Management Tests', () => {
    it('should return default smart groups', () => {
      const sgs = getSmartGroups()
      expect(sgs.length).toBeGreaterThanOrEqual(3)
      expect(sgs.some((g) => g.id === 'smart-review')).toBe(true)
      expect(sgs.some((g) => g.id === 'smart-this-week')).toBe(true)
      expect(sgs.some((g) => g.id === 'smart-not-exported')).toBe(true)
    })

    it('should create custom smart group and protect default smart groups from deletion', () => {
      const createdList = saveSmartGroup({
        name: '고품질 보고서',
        query: 'tag:보고서 score:>=85'
      })

      const customGroup = createdList.find((g) => g.name === '고품질 보고서')
      expect(customGroup).toBeDefined()
      expect(customGroup?.isDefault).toBe(false)

      // Try deleting default group (should be protected)
      deleteSmartGroup('smart-review')
      const afterProtect = getSmartGroups()
      expect(afterProtect.some((g) => g.id === 'smart-review')).toBe(true)

      // Delete custom group (should succeed)
      const afterCustomDel = deleteSmartGroup(customGroup!.id)
      expect(afterCustomDel.some((g) => g.id === customGroup!.id)).toBe(false)
    })

    it('should toggle starred status on document for Today view', () => {
      mockDbConversions.set('doc-star', {
        id: 701,
        slug: 'doc-star',
        title: 'Star 문서',
        is_starred: 0
      })

      const starred = toggleStarDocument(701)
      expect(starred?.is_starred).toBe(1)

      const unstarred = toggleStarDocument(701)
      expect(unstarred?.is_starred).toBe(0)
    })
  })
})
