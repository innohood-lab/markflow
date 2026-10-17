import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import {
  saveConversion,
  updateConversion,
  getConversionBySlug,
  getConversionById,
  deleteConversion,
  ConversionRecord
} from '../db'

export interface ParsedDocument {
  slug: string
  title: string
  status: string
  tags: string[]
  category: string
  groups: string[]
  source_file: string
  source_type: string
  converted_at: string
  quality_score: number | null
  first_image: string
  data: Record<string, any>
  content: string
}

/**
 * Extract the first markdown image URL/path from markdown content.
 * Matches: ![alt](url)
 */
export function extractFirstImage(content: string): string {
  const match = content.match(/!\[.*?\]\((.*?)\)/)
  if (match && match[1]) {
    return match[1].trim()
  }
  return ''
}

/**
 * Read and parse a markdown document file with gray-matter.
 */
export function readDocumentFile(filePath: string): ParsedDocument | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = matter(raw)
    const slug = path.basename(filePath, path.extname(filePath))
    const firstImg = extractFirstImage(parsed.content)

    const tags = Array.isArray(parsed.data.tags)
      ? parsed.data.tags.map((t: any) => String(t).trim())
      : []

    const groups = Array.isArray(parsed.data.groups)
      ? parsed.data.groups.map((g: any) => String(g).trim())
      : []

    return {
      slug,
      title: parsed.data.title || slug,
      status: parsed.data.status || 'inbox',
      tags,
      category: parsed.data.category || '',
      groups,
      source_file: parsed.data.source_file || `${slug}.md`,
      source_type: parsed.data.source_type || 'md',
      converted_at: parsed.data.converted_at || new Date().toISOString(),
      quality_score: typeof parsed.data.quality_score === 'number' ? parsed.data.quality_score : null,
      first_image: firstImg,
      data: parsed.data,
      content: parsed.content
    }
  } catch (err) {
    console.warn(`[DocumentService] Failed to parse document file ${filePath}:`, err)
    return null
  }
}

/**
 * Atomically update YAML frontmatter of a markdown file in Library and synchronize with DB.
 */
export function updateDocumentFrontmatter(
  slug: string,
  updates: Record<string, any>,
  customLibraryPath?: string
): ConversionRecord | null {
  const existing = getConversionBySlug(slug)
  const targetPath = customLibraryPath || existing?.library_path

  if (!targetPath || !fs.existsSync(targetPath)) {
    console.warn(`[DocumentService] Cannot find target file for slug: ${slug} at ${targetPath}`)
    return null
  }

  const raw = fs.readFileSync(targetPath, 'utf-8')
  const parsed = matter(raw)

  // Merge updates into frontmatter data
  const updatedData = { ...parsed.data, ...updates }

  // Re-serialize markdown with clean YAML frontmatter
  const updatedMarkdown = matter.stringify(parsed.content, updatedData)
  fs.writeFileSync(targetPath, updatedMarkdown, 'utf-8')

  const firstImg = extractFirstImage(parsed.content)
  const tags = Array.isArray(updatedData.tags) ? updatedData.tags : existing?.tags || []
  const groups = Array.isArray(updatedData.groups) ? updatedData.groups : existing?.groups || []

  // Update DB cache
  if (existing && existing.id) {
    const updated = updateConversion(existing.id, {
      title: updatedData.title ?? existing.title,
      status: updatedData.status ?? existing.status,
      category: updatedData.category ?? existing.category,
      tags: tags,
      groups: groups,
      quality_score: typeof updatedData.quality_score === 'number' ? updatedData.quality_score : existing.quality_score,
      markdown: updatedMarkdown,
      first_image: firstImg
    })
    return updated
  } else {
    // If not in DB, create new entry
    return saveConversion({
      slug,
      title: updatedData.title || slug,
      source_file: updatedData.source_file || `${slug}.md`,
      source_type: updatedData.source_type || 'md',
      converted_at: updatedData.converted_at || new Date().toISOString(),
      library_path: targetPath,
      status: updatedData.status || 'inbox',
      quality_score: updatedData.quality_score ?? 100,
      tags,
      category: updatedData.category || '',
      groups,
      first_image: firstImg,
      markdown: updatedMarkdown
    })
  }
}

/**
 * Create a new blank markdown document in Library.
 */
export function createNewDocument(params: {
  title?: string
  category?: string
  tags?: string[]
  content?: string
  libraryDir: string
}): ConversionRecord {
  const { title = '새 문서', category = '', tags = [], content = '', libraryDir } = params

  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true })
  }

  // Generate clean slug
  const baseSlug = title
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  let slug = baseSlug || 'untitled'
  let targetPath = path.join(libraryDir, `${slug}.md`)

  let counter = 1
  while (fs.existsSync(targetPath)) {
    slug = `${baseSlug}-${counter}`
    targetPath = path.join(libraryDir, `${slug}.md`)
    counter++
  }

  const now = new Date().toISOString()
  const frontmatterData: Record<string, any> = {
    title,
    status: 'inbox',
    tags,
    category,
    source_file: 'manual',
    source_type: 'md',
    converted_at: now,
    quality_score: 100,
    exported: { github: false, obsidian: false }
  }

  const initialBody = content || `# ${title}\n\n여기에 내용을 작성하세요.\n`
  const fullMarkdown = matter.stringify(initialBody, frontmatterData)

  fs.writeFileSync(targetPath, fullMarkdown, 'utf-8')

  return saveConversion({
    slug,
    title,
    source_file: 'manual',
    source_type: 'md',
    converted_at: now,
    library_path: targetPath,
    status: 'inbox',
    quality_score: 100,
    tags,
    category,
    first_image: '',
    markdown: fullMarkdown
  })
}

/**
 * Duplicate an existing document and its assets.
 */
export function duplicateDocument(slug: string, libraryDir: string): ConversionRecord | null {
  const existing = getConversionBySlug(slug)
  const sourcePath = existing?.library_path || path.join(libraryDir, `${slug}.md`)

  if (!fs.existsSync(sourcePath)) {
    return null
  }

  const raw = fs.readFileSync(sourcePath, 'utf-8')
  const parsed = matter(raw)

  let copySlug = `${slug}-copy`
  let targetPath = path.join(libraryDir, `${copySlug}.md`)
  let counter = 1
  while (fs.existsSync(targetPath)) {
    copySlug = `${slug}-copy-${counter}`
    targetPath = path.join(libraryDir, `${copySlug}.md`)
    counter++
  }

  // Clone assets folder if exists
  const sourceAssetDir = path.join(libraryDir, 'assets', slug)
  const targetAssetDir = path.join(libraryDir, 'assets', copySlug)
  if (fs.existsSync(sourceAssetDir)) {
    fs.mkdirSync(targetAssetDir, { recursive: true })
    const files = fs.readdirSync(sourceAssetDir)
    for (const f of files) {
      fs.copyFileSync(path.join(sourceAssetDir, f), path.join(targetAssetDir, f))
    }
  }

  // Rewrite asset paths in markdown content
  let clonedContent = parsed.content
  if (fs.existsSync(sourceAssetDir)) {
    clonedContent = clonedContent.replace(
      new RegExp(`assets/${slug}/`, 'g'),
      `assets/${copySlug}/`
    )
  }

  const newTitle = `${parsed.data.title || slug} (사본)`
  const now = new Date().toISOString()
  const newData = {
    ...parsed.data,
    title: newTitle,
    converted_at: now,
    exported: { github: false, obsidian: false }
  }

  const clonedMarkdown = matter.stringify(clonedContent, newData)
  fs.writeFileSync(targetPath, clonedMarkdown, 'utf-8')

  const firstImg = extractFirstImage(clonedContent)
  const tags = Array.isArray(newData.tags) ? newData.tags : []

  return saveConversion({
    slug: copySlug,
    title: newTitle,
    source_file: existing?.source_file || `${slug}.md`,
    source_type: existing?.source_type || 'md',
    converted_at: now,
    library_path: targetPath,
    status: newData.status || 'inbox',
    quality_score: existing?.quality_score ?? 100,
    tags,
    category: newData.category || '',
    first_image: firstImg,
    markdown: clonedMarkdown
  })
}

/**
 * Archive or unarchive a document by updating its frontmatter status.
 */
export function archiveDocument(slug: string, isArchived = true): ConversionRecord | null {
  return updateDocumentFrontmatter(slug, {
    status: isArchived ? 'archived' : 'inbox'
  })
}

/**
 * Rebuild the entire SQLite database and FTS5 index from markdown files in Library.
 */
export function rebuildLibraryIndex(libraryDir: string): {
  indexedCount: number
  errors: string[]
} {
  if (!fs.existsSync(libraryDir)) {
    return { indexedCount: 0, errors: [`Library directory not found: ${libraryDir}`] }
  }

  let indexedCount = 0
  const errors: string[] = []

  try {
    const entries = fs.readdirSync(libraryDir, { withFileTypes: true })
    for (const entry of entries) {
      // Ignore subdirectories (assets, .history) and non-markdown files
      if (entry.isDirectory() || !entry.name.endsWith('.md')) {
        continue
      }

      const filePath = path.join(libraryDir, entry.name)
      const doc = readDocumentFile(filePath)
      if (doc) {
        try {
          saveConversion({
            slug: doc.slug,
            title: doc.title,
            source_file: doc.source_file,
            source_type: doc.source_type,
            converted_at: doc.converted_at,
            library_path: filePath,
            status: doc.status,
            quality_score: doc.quality_score,
            tags: doc.tags,
            category: doc.category,
            groups: doc.groups,
            first_image: doc.first_image,
            markdown: matter.stringify(doc.content, doc.data)
          })
          indexedCount++
        } catch (err: any) {
          errors.push(`Error indexing ${entry.name}: ${err.message}`)
        }
      }
    }
  } catch (err: any) {
    errors.push(`Failed to read Library directory: ${err.message}`)
  }

  return { indexedCount, errors }
}

/**
 * Batch update documents (status, tag additions/removals, category, deletion).
 */
export function batchUpdateDocuments(
  slugs: string[],
  operations: {
    status?: string
    addTag?: string
    removeTag?: string
    category?: string
    delete?: boolean
  }
): { successCount: number; errors: string[] } {
  let successCount = 0
  const errors: string[] = []

  for (const slug of slugs) {
    try {
      const existing = getConversionBySlug(slug)
      if (!existing) continue

      if (operations.delete && existing.id) {
        deleteConversion(existing.id)
        if (existing.library_path && fs.existsSync(existing.library_path)) {
          // Rename or remove
          try {
            fs.unlinkSync(existing.library_path)
          } catch {}
        }
        successCount++
        continue
      }

      const updates: Record<string, any> = {}
      if (operations.status) {
        updates.status = operations.status
      }
      if (operations.category !== undefined) {
        updates.category = operations.category
      }

      let currentTags = existing.tags || []
      if (operations.addTag && !currentTags.includes(operations.addTag)) {
        currentTags = [...currentTags, operations.addTag]
        updates.tags = currentTags
      }
      if (operations.removeTag) {
        currentTags = currentTags.filter((t) => t !== operations.removeTag)
        updates.tags = currentTags
      }

      const updated = updateDocumentFrontmatter(slug, updates)
      if (updated) successCount++
    } catch (err: any) {
      errors.push(`Failed to update ${slug}: ${err.message}`)
    }
  }

  return { successCount, errors }
}
