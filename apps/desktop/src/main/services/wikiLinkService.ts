import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { getConversions, getConversionBySlug } from '../db'

export interface BacklinkItem {
  sourceSlug: string
  sourceTitle: string
  snippet: string
}

export interface HighlightItem {
  slug: string
  title: string
  text: string
  type: 'highlight' | 'note'
  note?: string
}

/**
 * Extract all [[Wiki Link]] targets from markdown content.
 */
export function extractWikiLinks(markdown: string): string[] {
  if (!markdown) return []
  const matches = markdown.matchAll(/\[\[(.*?)\]\]/g)
  const links: string[] = []
  for (const m of matches) {
    if (m[1]) {
      // Handle alias: [[Target Title|Alias]] -> Target Title
      const target = m[1].split('|')[0].trim()
      if (target) links.push(target)
    }
  }
  return links
}

/**
 * Find all documents in Library that link to the target document via [[title]] or [[slug]].
 */
export function findBacklinks(
  targetTitle: string,
  targetSlug: string,
  libraryDir: string
): BacklinkItem[] {
  const backlinks: BacklinkItem[] = []
  if (!fs.existsSync(libraryDir)) return backlinks

  try {
    const entries = fs.readdirSync(libraryDir, { withFileTypes: true })
    const targetPatterns = [
      new RegExp(`\\[\\[${escapeRegex(targetTitle)}(\\|.*?)?\\]\\]`, 'i'),
      new RegExp(`\\[\\[${escapeRegex(targetSlug)}(\\|.*?)?\\]\\]`, 'i')
    ]

    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith('.md')) continue
      const sourceSlug = path.basename(entry.name, '.md')
      if (sourceSlug === targetSlug) continue // Skip self-link

      const filePath = path.join(libraryDir, entry.name)
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = matter(raw)
        const content = parsed.content

        for (const pattern of targetPatterns) {
          const match = pattern.exec(content)
          if (match) {
            // Extract snippet around link
            const start = Math.max(0, match.index - 40)
            const end = Math.min(content.length, match.index + match[0].length + 40)
            const rawSnippet = content.substring(start, end).replace(/\n+/g, ' ').trim()
            const snippet = (start > 0 ? '...' : '') + rawSnippet + (end < content.length ? '...' : '')

            backlinks.push({
              sourceSlug,
              sourceTitle: parsed.data.title || sourceSlug,
              snippet
            })
            break
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[WikiLinkService] Error scanning backlinks:', err)
  }

  return backlinks
}

/**
 * Safely rename wiki link occurrences [[oldTitle]] -> [[newTitle]] across all library files.
 */
export function renameWikiLinkReferences(
  oldTitle: string,
  newTitle: string,
  libraryDir: string
): { updatedFilesCount: number } {
  let updatedFilesCount = 0
  if (!fs.existsSync(libraryDir) || !oldTitle || !newTitle || oldTitle === newTitle) {
    return { updatedFilesCount: 0 }
  }

  try {
    const entries = fs.readdirSync(libraryDir, { withFileTypes: true })
    const targetPattern = new RegExp(`\\[\\[${escapeRegex(oldTitle)}(\\|.*?)?\\]\\]`, 'g')

    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith('.md')) continue
      const filePath = path.join(libraryDir, entry.name)

      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        if (targetPattern.test(raw)) {
          const updatedRaw = raw.replace(targetPattern, (_m, alias) => {
            return alias ? `[[${newTitle}${alias}]]` : `[[${newTitle}]]`
          })
          fs.writeFileSync(filePath, updatedRaw, 'utf-8')
          updatedFilesCount++
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[WikiLinkService] Error renaming wiki links:', err)
  }

  return { updatedFilesCount }
}

/**
 * Add Obsidian-style highlight ==text== to a markdown document on disk.
 */
export function addHighlightToDocument(
  filePath: string,
  selectedText: string
): { success: boolean; markdown?: string; error?: string } {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: '파일을 찾을 수 없습니다.' }
  }
  const cleanSelected = selectedText.trim()
  if (!cleanSelected) {
    return { success: false, error: '선택된 텍스트가 없습니다.' }
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    // Avoid double wrapping if already highlighted
    if (raw.includes(`==${cleanSelected}==`)) {
      return { success: true, markdown: raw }
    }

    if (!raw.includes(cleanSelected)) {
      return { success: false, error: '문서 본문에서 선택한 텍스트를 찾을 수 없습니다.' }
    }

    const updated = raw.replace(cleanSelected, `==${cleanSelected}==`)
    fs.writeFileSync(filePath, updated, 'utf-8')
    return { success: true, markdown: updated }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Add Obsidian-compatible footnote note [^note-id] to a markdown document on disk.
 */
export function addFootnoteNoteToDocument(
  filePath: string,
  selectedText: string,
  noteText: string
): { success: boolean; markdown?: string; error?: string } {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: '파일을 찾을 수 없습니다.' }
  }
  const cleanSelected = selectedText.trim()
  const cleanNote = noteText.trim()
  if (!cleanSelected || !cleanNote) {
    return { success: false, error: '텍스트 또는 메모 내용이 비어 있습니다.' }
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    if (!raw.includes(cleanSelected)) {
      return { success: false, error: '문서 본문에서 선택한 텍스트를 찾을 수 없습니다.' }
    }

    const noteId = `note-${Date.now().toString(36)}`
    const marker = `[^${noteId}]`
    const definition = `\n\n[^${noteId}]: ${cleanNote}\n`

    // Replace selected text with selectedText + marker
    const updated = raw.replace(cleanSelected, `${cleanSelected}${marker}`) + definition
    fs.writeFileSync(filePath, updated, 'utf-8')
    return { success: true, markdown: updated }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Extract all highlights (==...==) and footnote notes across the entire library.
 */
export function getAllHighlights(libraryDir: string): HighlightItem[] {
  const items: HighlightItem[] = []
  if (!fs.existsSync(libraryDir)) return items

  try {
    const entries = fs.readdirSync(libraryDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() || !entry.name.endsWith('.md')) continue
      const slug = path.basename(entry.name, '.md')
      const filePath = path.join(libraryDir, entry.name)

      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = matter(raw)
        const title = parsed.data.title || slug
        const content = parsed.content

        // 1. Match ==highlights==
        const highlightMatches = content.matchAll(/==([^=]+)==/g)
        for (const hm of highlightMatches) {
          if (hm[1] && hm[1].trim()) {
            items.push({
              slug,
              title,
              text: hm[1].trim(),
              type: 'highlight'
            })
          }
        }

        // 2. Match [^note]: definition
        const noteMatches = content.matchAll(/\[\^([^\]]+)\]:\s*([^\n]+)/g)
        for (const nm of noteMatches) {
          if (nm[2] && nm[2].trim()) {
            items.push({
              slug,
              title,
              text: nm[1].trim(),
              type: 'note',
              note: nm[2].trim()
            })
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[WikiLinkService] Error getting highlights:', err)
  }

  return items
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
