import { getSetting, setSetting, getConversions, updateConversion, getConversionBySlug, ConversionRecord } from '../db'
import { updateDocumentFrontmatter } from './documentService'
import { parseSearchQuery, buildSqlFilterFromQuery } from './searchQueryParser'

export interface ProjectItem {
  id: string
  name: string
  groupPath: string // e.g. "업무/AX 추진"
}

export interface AreaItem {
  id: string
  name: string
  projects: ProjectItem[]
}

export interface SmartGroup {
  id: string
  name: string
  query: string
  icon?: string
  isDefault?: boolean
}

const DEFAULT_AREAS: AreaItem[] = [
  {
    id: 'area-work',
    name: '업무',
    projects: [
      { id: 'proj-ax', name: 'AX 추진', groupPath: '업무/AX 추진' },
      { id: 'proj-argos', name: 'B.Argos', groupPath: '업무/B.Argos' }
    ]
  },
  {
    id: 'area-personal',
    name: '개인',
    projects: [
      { id: 'proj-study', name: '지식 관리', groupPath: '개인/지식 관리' }
    ]
  }
]

const DEFAULT_SMART_GROUPS: SmartGroup[] = [
  {
    id: 'smart-review',
    name: '검토 필요',
    query: 'score:<70 status:review_needed',
    icon: 'AlertCircle',
    isDefault: true
  },
  {
    id: 'smart-this-week',
    name: '이번 주 추가',
    query: 'date:this_week',
    icon: 'Calendar',
    isDefault: true
  },
  {
    id: 'smart-not-exported',
    name: '내보내지 않음',
    query: 'exported:false',
    icon: 'Share2',
    isDefault: true
  }
]

/**
 * Load Areas and Projects from app_settings or defaults.
 */
export function getAreaHierarchy(): AreaItem[] {
  const raw = getSetting('markflow_areas')
  if (!raw) {
    setSetting('markflow_areas', JSON.stringify(DEFAULT_AREAS))
    return DEFAULT_AREAS
  }
  try {
    return JSON.parse(raw)
  } catch {
    return DEFAULT_AREAS
  }
}

/**
 * Save Areas and Projects to app_settings.
 */
export function saveAreaHierarchy(areas: AreaItem[]): AreaItem[] {
  setSetting('markflow_areas', JSON.stringify(areas))
  return areas
}

export function addArea(name: string): AreaItem[] {
  const areas = getAreaHierarchy()
  const id = `area-${Date.now().toString(36)}`
  areas.push({
    id,
    name: name.trim(),
    projects: []
  })
  return saveAreaHierarchy(areas)
}

export function addProject(areaId: string, projectName: string): AreaItem[] {
  const areas = getAreaHierarchy()
  const area = areas.find((a) => a.id === areaId)
  if (area) {
    const id = `proj-${Date.now().toString(36)}`
    area.projects.push({
      id,
      name: projectName.trim(),
      groupPath: `${area.name}/${projectName.trim()}`
    })
  }
  return saveAreaHierarchy(areas)
}

export function deleteAreaOrProject(id: string): AreaItem[] {
  let areas = getAreaHierarchy()
  if (id.startsWith('area-')) {
    areas = areas.filter((a) => a.id !== id)
  } else {
    for (const a of areas) {
      a.projects = a.projects.filter((p) => p.id !== id)
    }
  }
  return saveAreaHierarchy(areas)
}

/**
 * DEVONthink-style Replicant:
 * Assign a document to a group (Area/Project) by updating frontmatter groups: [...]
 * If replace is false, appends to groups; if true, overwrites groups.
 */
export function assignDocumentToGroup(
  slug: string,
  groupPath: string,
  replace = false
): ConversionRecord | null {
  const existing = getConversionBySlug(slug)
  if (!existing) return null

  let currentGroups = existing.groups || []
  if (replace) {
    currentGroups = [groupPath]
  } else if (!currentGroups.includes(groupPath)) {
    currentGroups = [...currentGroups, groupPath]
  }

  return updateDocumentFrontmatter(slug, { groups: currentGroups })
}

/**
 * Load Smart Groups from app_settings or defaults.
 */
export function getSmartGroups(): SmartGroup[] {
  const raw = getSetting('markflow_smart_groups')
  if (!raw) {
    setSetting('markflow_smart_groups', JSON.stringify(DEFAULT_SMART_GROUPS))
    return DEFAULT_SMART_GROUPS
  }
  try {
    const parsed: SmartGroup[] = JSON.parse(raw)
    // Ensure default groups are always included
    const existingIds = new Set(parsed.map((g) => g.id))
    for (const def of DEFAULT_SMART_GROUPS) {
      if (!existingIds.has(def.id)) {
        parsed.unshift(def)
      }
    }
    return parsed
  } catch {
    return DEFAULT_SMART_GROUPS
  }
}

/**
 * Save or create a Smart Group.
 */
export function saveSmartGroup(group: { name: string; query: string; icon?: string }): SmartGroup[] {
  const list = getSmartGroups()
  const id = `smart-${Date.now().toString(36)}`
  const newGroup: SmartGroup = {
    id,
    name: group.name.trim(),
    query: group.query.trim(),
    icon: group.icon || 'Tag',
    isDefault: false
  }
  list.push(newGroup)
  setSetting('markflow_smart_groups', JSON.stringify(list))
  return list
}

export function deleteSmartGroup(id: string): SmartGroup[] {
  let list = getSmartGroups()
  // Cannot delete defaults
  list = list.filter((g) => g.id !== id || g.isDefault)
  setSetting('markflow_smart_groups', JSON.stringify(list))
  return list
}

/**
 * Toggle starred status of a document for Today / Starred views.
 */
export function toggleStarDocument(id: number): ConversionRecord | null {
  const docs = getConversions()
  const target = docs.find((d) => d.id === id)
  if (!target) return null

  const nextStarred = target.is_starred ? 0 : 1
  return updateConversion(id, { is_starred: nextStarred })
}
