import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { createNewDocument } from './documentService'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  icon?: string
  frontmatter: Record<string, any>
  body: string
  isDefault?: boolean
}

const DEFAULT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'meeting',
    name: '회의록',
    description: '안건, 논의 내용 및 실행 항목(Action Items) 정리',
    icon: 'Users',
    isDefault: true,
    frontmatter: {
      category: '회의',
      tags: ['회의록', '업무'],
      status: 'inbox'
    },
    body: `## 1. 회의 개요
- **일시**: ${new Date().toISOString().slice(0, 10)}
- **참석자**: 
- **안건**: 

---

## 2. 주요 논의 내용
- 

---

## 3. 결정 사항
- 

---

## 4. 실행 과제 (Action Items)
- [ ] 
- [ ] 
`
  },
  {
    id: 'project_spec',
    name: '기획서',
    description: '목표, 배경, 핵심 가설 및 기능 명세 정의',
    icon: 'FileText',
    isDefault: true,
    frontmatter: {
      category: '기획',
      tags: ['기획', '스펙'],
      status: 'inbox'
    },
    body: `## 1. 배경 및 문제 정의
- **배경**: 
- **해결하려는 문제**: 

---

## 2. 목표 및 핵심 지표
- **목표**: 
- **성공 지표 (KPI / OKR)**: 

---

## 3. 기능 명세
### 핵심 요구사항
1. 

---

## 4. 마일스톤 및 일정
- [ ] 1단계: 
- [ ] 2단계: 
`
  },
  {
    id: 'tech_review',
    name: '기술 분석 / 아티클 리뷰',
    description: '신기술, 오픈소스, 논문 및 아티클 인사이트 분석',
    icon: 'Cpu',
    isDefault: true,
    frontmatter: {
      category: '연구',
      tags: ['기술분석', '인사이트'],
      status: 'inbox'
    },
    body: `## 1. 요약
- **주제**: 
- **한 줄 요약**: 

---

## 2. 핵심 내용
- 

---

## 3. 기술적 장단점
- **장점**: 
- **한계점**: 

---

## 4. 실무 적용 방안
- 
`
  },
  {
    id: 'weekly_review',
    name: '주간 회고 (Weekly Review)',
    description: '한 주간의 성과, 잘한 점, 개선점 및 다음 주 목표',
    icon: 'Calendar',
    isDefault: true,
    frontmatter: {
      category: '회고',
      tags: ['회고', '주간'],
      status: 'inbox'
    },
    body: `## 1. 이번 주 한 일 (Done)
- [x] 

---

## 2. 잘한 점 (Keep)
- 

---

## 3. 아쉬운 점 및 개선할 점 (Problem & Try)
- **Problem**: 
- **Try**: 

---

## 4. 다음 주 우선순위 (Next Priorities)
1. 
2. 
`
  }
]

/**
 * Ensure templates directory exists and initialize default templates if empty.
 */
export function ensureTemplates(libraryDir: string): DocumentTemplate[] {
  const templatesDir = path.join(libraryDir, '.templates')
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true })
  }

  // Load user templates from disk
  const userTemplates: DocumentTemplate[] = []
  try {
    const entries = fs.readdirSync(templatesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith('.md')) continue
      const id = path.basename(entry.name, '.md')
      const filePath = path.join(templatesDir, entry.name)

      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = matter(raw)
        userTemplates.push({
          id,
          name: parsed.data.name || id,
          description: parsed.data.description || '',
          icon: parsed.data.icon || 'FileText',
          frontmatter: parsed.data.frontmatter || {},
          body: parsed.content || '',
          isDefault: false
        })
      } catch {}
    }
  } catch (err) {
    console.warn('[TemplateService] Error scanning templates dir:', err)
  }

  // Merge default templates (if user hasn't overridden by ID)
  const existingIds = new Set(userTemplates.map((t) => t.id))
  const combined = [...userTemplates]

  for (const def of DEFAULT_TEMPLATES) {
    if (!existingIds.has(def.id)) {
      combined.push(def)
    }
  }

  return combined
}

/**
 * Save or create a custom template.
 */
export function saveTemplate(
  libraryDir: string,
  template: Omit<DocumentTemplate, 'isDefault'>
): DocumentTemplate[] {
  const templatesDir = path.join(libraryDir, '.templates')
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true })
  }

  const id = template.id || `custom-${Date.now().toString(36)}`
  const filePath = path.join(templatesDir, `${id}.md`)

  const fileData = {
    name: template.name,
    description: template.description,
    icon: template.icon || 'FileText',
    frontmatter: template.frontmatter || {}
  }

  const fullContent = matter.stringify(template.body, fileData)
  fs.writeFileSync(filePath, fullContent, 'utf-8')

  return ensureTemplates(libraryDir)
}

/**
 * Create a new document in the library applying a template.
 */
export function createDocumentFromTemplate(
  libraryDir: string,
  templateId: string,
  customTitle?: string
): { success: boolean; item: any } {
  const all = ensureTemplates(libraryDir)
  const found = all.find((t) => t.id === templateId) || DEFAULT_TEMPLATES[0]

  const title = customTitle?.trim() || `${found.name} - ${new Date().toISOString().slice(0, 10)}`

  const doc = createNewDocument({
    title,
    libraryDir,
    content: found.body,
    tags: found.frontmatter.tags || [],
    category: found.frontmatter.category || '',
    status: found.frontmatter.status || 'inbox'
  })

  return { success: !!doc, item: doc }
}

/**
 * Quick capture a quick thought/note directly into library inbox.
 */
export function quickCaptureNote(
  libraryDir: string,
  title: string,
  body: string,
  tags: string[] = []
): { success: boolean; item: any } {
  const cleanTitle = title.trim() || `빠른 캡처 - ${new Date().toLocaleTimeString('ko-KR', { hour12: false })}`
  const doc = createNewDocument({
    title: cleanTitle,
    libraryDir,
    content: body.trim(),
    tags: tags.length > 0 ? tags : ['빠른캡처'],
    status: 'inbox'
  })

  return { success: !!doc, item: doc }
}
