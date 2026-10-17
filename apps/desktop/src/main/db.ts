import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { createRequire } from 'module'
import { parseSearchQuery, buildSqlFilterFromQuery } from './services/searchQueryParser'

const nodeRequire = createRequire(import.meta.url)
const Database = nodeRequire('better-sqlite3')

export interface ConversionRecord {
  id?: number
  slug: string
  title: string
  source_file: string
  source_path?: string
  source_type: string
  source_location?: string
  file_hash?: string
  file_size?: number
  converted_at: string
  library_path: string
  status?: string
  quality_score?: number | null
  profile?: string
  markdown?: string
  exported_json?: string
  tags?: string[]
  tags_json?: string
  category?: string
  first_image?: string
  custom_json?: string
  groups?: string[]
  groups_json?: string
  is_starred?: number
  is_deleted?: number
  created_at?: string
}

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (db) return db

  const userDataPath = app?.getPath
    ? app.getPath('userData')
    : path.join(os.tmpdir(), 'markflow-test-userdata')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = path.join(userDataPath, 'markflow.db')
  console.log(`[DB] Initializing SQLite database at: ${dbPath}`)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_path TEXT,
      source_type TEXT NOT NULL,
      source_location TEXT,
      file_hash TEXT,
      file_size INTEGER DEFAULT 0,
      converted_at TEXT NOT NULL,
      library_path TEXT NOT NULL,
      status TEXT DEFAULT 'inbox',
      quality_score INTEGER,
      profile TEXT DEFAULT 'balanced',
      markdown TEXT,
      exported_json TEXT DEFAULT '{}',
      tags_json TEXT DEFAULT '[]',
      category TEXT DEFAULT '',
      first_image TEXT DEFAULT '',
      custom_json TEXT DEFAULT '{}',
      groups_json TEXT DEFAULT '[]',
      is_starred INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_conversions_converted_at ON conversions(converted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);
    CREATE INDEX IF NOT EXISTS idx_conversions_hash ON conversions(file_hash);
    CREATE INDEX IF NOT EXISTS idx_conversions_category ON conversions(category);
    CREATE INDEX IF NOT EXISTS idx_conversions_starred ON conversions(is_starred);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS export_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversion_id INTEGER,
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      ref_or_path TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_export_logs_conv ON export_logs(conversion_id);
  `)

  // Safe migrations for newly added columns
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN profile TEXT DEFAULT 'balanced';`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN source_location TEXT;`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN file_hash TEXT;`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN tags_json TEXT DEFAULT '[]';`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN category TEXT DEFAULT '';`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN first_image TEXT DEFAULT '';`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN custom_json TEXT DEFAULT '{}';`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN groups_json TEXT DEFAULT '[]';`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN is_starred INTEGER DEFAULT 0;`)
  } catch {}

  // FTS5 Full-Text Search Virtual Table with Trigram Tokenizer
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS conversions_fts USING fts5(
        slug UNINDEXED,
        title,
        content,
        tags,
        category,
        tokenize='trigram'
      );
    `)
  } catch (err) {
    console.warn('[DB] Trigram tokenizer init failed, falling back to unicode61:', err)
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS conversions_fts USING fts5(
          slug UNINDEXED,
          title,
          content,
          tags,
          category
        );
      `)
    } catch (err2) {
      console.warn('[DB] FTS5 initialization error:', err2)
    }
  }

  return db
}

/**
 * Upsert into FTS5 index for high-speed Korean/English full-text search.
 */
export function upsertFtsIndex(
  slug: string,
  title: string,
  content: string,
  tags: string,
  category: string
): void {
  try {
    const database = getDatabase()
    const delStmt = database.prepare('DELETE FROM conversions_fts WHERE slug = ?')
    delStmt.run(slug)

    const insStmt = database.prepare(`
      INSERT INTO conversions_fts (slug, title, content, tags, category)
      VALUES (?, ?, ?, ?, ?)
    `)
    insStmt.run(slug, title, content, tags, category)
  } catch (err) {
    console.warn(`[DB] FTS5 index upsert error for ${slug}:`, err)
  }
}

/**
 * Remove an entry from FTS5 index.
 */
export function deleteFtsIndex(slug: string): void {
  try {
    const database = getDatabase()
    const stmt = database.prepare('DELETE FROM conversions_fts WHERE slug = ?')
    stmt.run(slug)
  } catch (err) {
    console.warn(`[DB] FTS5 index delete error for ${slug}:`, err)
  }
}

export function saveConversion(record: ConversionRecord): ConversionRecord {
  const database = getDatabase()

  let tagsArray: string[] = []
  if (Array.isArray(record.tags)) {
    tagsArray = record.tags
  } else if (record.tags_json) {
    try {
      tagsArray = JSON.parse(record.tags_json)
    } catch {}
  }
  const tagsJsonStr = JSON.stringify(tagsArray)

  let groupsArray: string[] = []
  if (Array.isArray(record.groups)) {
    groupsArray = record.groups
  } else if (record.groups_json) {
    try {
      groupsArray = JSON.parse(record.groups_json)
    } catch {}
  }
  const groupsJsonStr = JSON.stringify(groupsArray)

  const stmt = database.prepare(`
    INSERT INTO conversions (
      slug, title, source_file, source_path, source_type, source_location, file_hash, file_size,
      converted_at, library_path, status, quality_score, profile, markdown, exported_json,
      tags_json, category, first_image, custom_json, groups_json, is_starred
    ) VALUES (
      @slug, @title, @source_file, @source_path, @source_type, @source_location, @file_hash, @file_size,
      @converted_at, @library_path, @status, @quality_score, @profile, @markdown, @exported_json,
      @tags_json, @category, @first_image, @custom_json, @groups_json, @is_starred
    )
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      source_file = excluded.source_file,
      source_path = excluded.source_path,
      source_type = excluded.source_type,
      source_location = excluded.source_location,
      file_hash = excluded.file_hash,
      file_size = excluded.file_size,
      converted_at = excluded.converted_at,
      library_path = excluded.library_path,
      status = excluded.status,
      quality_score = excluded.quality_score,
      profile = excluded.profile,
      markdown = excluded.markdown,
      tags_json = excluded.tags_json,
      category = excluded.category,
      first_image = excluded.first_image,
      custom_json = excluded.custom_json,
      groups_json = excluded.groups_json,
      is_starred = excluded.is_starred,
      is_deleted = 0
  `)

  const info = stmt.run({
    slug: record.slug,
    title: record.title,
    source_file: record.source_file,
    source_path: record.source_path || '',
    source_type: record.source_type,
    source_location: record.source_location || '',
    file_hash: record.file_hash || '',
    file_size: record.file_size || 0,
    converted_at: record.converted_at,
    library_path: record.library_path,
    status: record.status || 'inbox',
    quality_score: record.quality_score ?? null,
    profile: record.profile || 'balanced',
    markdown: record.markdown || '',
    exported_json: record.exported_json || '{}',
    tags_json: tagsJsonStr,
    category: record.category || '',
    first_image: record.first_image || '',
    custom_json: record.custom_json || '{}',
    groups_json: groupsJsonStr,
    is_starred: record.is_starred ? 1 : 0
  })

  // Synchronize FTS5 index
  upsertFtsIndex(
    record.slug,
    record.title,
    record.markdown || '',
    tagsArray.join(' '),
    record.category || ''
  )

  return {
    ...record,
    tags: tagsArray,
    tags_json: tagsJsonStr,
    groups: groupsArray,
    groups_json: groupsJsonStr,
    is_starred: record.is_starred ? 1 : 0,
    id: Number(info.lastInsertRowid)
  }
}

export function findConversionByHash(hash: string): ConversionRecord | null {
  if (!hash) return null
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM conversions WHERE file_hash = ? AND is_deleted = 0 LIMIT 1')
  const row = stmt.get(hash) as any
  if (!row) return null
  try {
    row.tags = JSON.parse(row.tags_json || '[]')
  } catch {
    row.tags = []
  }
  try {
    row.groups = JSON.parse(row.groups_json || '[]')
  } catch {
    row.groups = []
  }
  return row as ConversionRecord
}

export function getConversions(params?: {
  search?: string
  sort?: 'latest' | 'name' | 'score'
  reviewOnly?: boolean
  status?: string
  category?: string
  tag?: string
  group?: string
  includeArchived?: boolean
  starredOnly?: boolean
  todayOnly?: boolean
}): ConversionRecord[] {
  const database = getDatabase()
  let sql = 'SELECT * FROM conversions WHERE is_deleted = 0'
  const queryParams: any = {}

  if (params?.todayOnly) {
    const today = new Date().toISOString().split('T')[0]
    sql += ` AND (is_starred = 1 OR converted_at LIKE '${today}%' OR status = 'review_needed' OR (quality_score IS NOT NULL AND quality_score < 70))`
  } else if (params?.starredOnly) {
    sql += ' AND is_starred = 1'
  } else if (params?.reviewOnly) {
    sql += " AND (status = 'review_needed' OR (quality_score IS NOT NULL AND quality_score < 70))"
  } else if (params?.status) {
    sql += ' AND status = @status'
    queryParams.status = params.status
  } else if (!params?.includeArchived) {
    // Hide archived by default
    sql += " AND status != 'archived'"
  }

  if (params?.category) {
    sql += ' AND category = @category'
    queryParams.category = params.category
  }

  if (params?.tag) {
    sql += ' AND tags_json LIKE @tag'
    queryParams.tag = `%"${params.tag}"%`
  }

  if (params?.group) {
    sql += ' AND groups_json LIKE @group'
    queryParams.group = `%${params.group}%`
  }

  // Parse advanced query syntax if query contains special operators or fields
  if (params?.search && params.search.trim().length > 0) {
    const rawSearch = params.search.trim()
    const parsed = parseSearchQuery(rawSearch)

    // If query has field queries, date, score, negations, or phrases:
    if (
      parsed.tags.length > 0 ||
      parsed.types.length > 0 ||
      parsed.statuses.length > 0 ||
      parsed.groups.length > 0 ||
      parsed.dateComparison ||
      parsed.scoreComparison ||
      parsed.exportedFilter !== undefined ||
      parsed.negations.length > 0 ||
      parsed.phrases.length > 0 ||
      parsed.hasOrCondition
    ) {
      const { whereClauses, params: sqlParams } = buildSqlFilterFromQuery(parsed)
      if (whereClauses.length > 0) {
        sql += ` AND (${whereClauses.join(' AND ')})`
        Object.assign(queryParams, sqlParams)
      }
    } else {
      // Standard text search via FTS5 or LIKE
      try {
        const ftsStmt = database.prepare(`
          SELECT slug FROM conversions_fts
          WHERE conversions_fts MATCH ?
          ORDER BY rank
        `)
        const ftsMatches = ftsStmt.all(`"${rawSearch.replace(/"/g, '""')}"`) as { slug: string }[]
        if (ftsMatches.length > 0) {
          const slugs = ftsMatches.map((m) => `'${m.slug.replace(/'/g, "''")}'`).join(',')
          sql += ` AND slug IN (${slugs})`
        } else {
          sql += ' AND (title LIKE @search OR source_file LIKE @search OR markdown LIKE @search)'
          queryParams.search = `%${rawSearch}%`
        }
      } catch {
        sql += ' AND (title LIKE @search OR source_file LIKE @search OR markdown LIKE @search)'
        queryParams.search = `%${rawSearch}%`
      }
    }
  }

  if (params?.sort === 'name') {
    sql += ' ORDER BY title ASC'
  } else if (params?.sort === 'score') {
    sql += ' ORDER BY quality_score DESC, converted_at DESC'
  } else {
    sql += ' ORDER BY converted_at DESC'
  }

  const stmt = database.prepare(sql)
  const rows = stmt.all(queryParams) as any[]

  return rows.map((row) => {
    try {
      row.tags = JSON.parse(row.tags_json || '[]')
    } catch {
      row.tags = []
    }
    try {
      row.groups = JSON.parse(row.groups_json || '[]')
    } catch {
      row.groups = []
    }
    return row as ConversionRecord
  })
}

export function getReviewNeededCount(): number {
  const database = getDatabase()
  const stmt = database.prepare(
    "SELECT COUNT(*) as count FROM conversions WHERE is_deleted = 0 AND (status = 'review_needed' OR (quality_score IS NOT NULL AND quality_score < 70))"
  )
  const row = stmt.get() as { count: number } | undefined
  return row?.count || 0
}

export function deleteConversion(id: number): ConversionRecord | null {
  const database = getDatabase()
  const findStmt = database.prepare('SELECT * FROM conversions WHERE id = ?')
  const item = findStmt.get(id) as ConversionRecord | undefined

  if (!item) return null

  const deleteStmt = database.prepare('UPDATE conversions SET is_deleted = 1 WHERE id = ?')
  deleteStmt.run(id)

  deleteFtsIndex(item.slug)

  return item
}

export function restoreConversion(id: number): ConversionRecord | null {
  const database = getDatabase()
  const restoreStmt = database.prepare('UPDATE conversions SET is_deleted = 0 WHERE id = ?')
  restoreStmt.run(id)

  const findStmt = database.prepare('SELECT * FROM conversions WHERE id = ?')
  const restored = findStmt.get(id) as ConversionRecord | undefined
  if (restored) {
    let tagsStr = ''
    try {
      tagsStr = JSON.parse(restored.tags_json || '[]').join(' ')
    } catch {}
    upsertFtsIndex(restored.slug, restored.title, restored.markdown || '', tagsStr, restored.category || '')
  }
  return restored || null
}

export function updateConversion(id: number, updates: Partial<ConversionRecord>): ConversionRecord | null {
  const database = getDatabase()
  const findStmt = database.prepare('SELECT * FROM conversions WHERE id = ?')
  const existing = findStmt.get(id) as ConversionRecord | undefined
  if (!existing) return null

  const fields: string[] = []
  const values: any = { id }

  if (updates.title !== undefined) {
    fields.push('title = @title')
    values.title = updates.title
  }
  if (updates.status !== undefined) {
    fields.push('status = @status')
    values.status = updates.status
  }
  if (updates.markdown !== undefined) {
    fields.push('markdown = @markdown')
    values.markdown = updates.markdown
  }
  if (updates.quality_score !== undefined) {
    fields.push('quality_score = @quality_score')
    values.quality_score = updates.quality_score
  }
  if (updates.profile !== undefined) {
    fields.push('profile = @profile')
    values.profile = updates.profile
  }
  if (updates.exported_json !== undefined) {
    fields.push('exported_json = @exported_json')
    values.exported_json = updates.exported_json
  }
  if (updates.category !== undefined) {
    fields.push('category = @category')
    values.category = updates.category
  }
  if (updates.tags !== undefined) {
    fields.push('tags_json = @tags_json')
    values.tags_json = JSON.stringify(updates.tags)
  } else if (updates.tags_json !== undefined) {
    fields.push('tags_json = @tags_json')
    values.tags_json = updates.tags_json
  }
  if (updates.first_image !== undefined) {
    fields.push('first_image = @first_image')
    values.first_image = updates.first_image
  }
  if (updates.custom_json !== undefined) {
    fields.push('custom_json = @custom_json')
    values.custom_json = updates.custom_json
  }
  if (updates.groups !== undefined) {
    fields.push('groups_json = @groups_json')
    values.groups_json = JSON.stringify(updates.groups)
  } else if (updates.groups_json !== undefined) {
    fields.push('groups_json = @groups_json')
    values.groups_json = updates.groups_json
  }
  if (updates.is_starred !== undefined) {
    fields.push('is_starred = @is_starred')
    values.is_starred = updates.is_starred ? 1 : 0
  }

  if (fields.length > 0) {
    const updateSql = `UPDATE conversions SET ${fields.join(', ')} WHERE id = @id`
    const stmt = database.prepare(updateSql)
    stmt.run(values)
  }

  const updated = findStmt.get(id) as any
  if (updated) {
    try {
      updated.tags = JSON.parse(updated.tags_json || '[]')
    } catch {
      updated.tags = []
    }
    try {
      updated.groups = JSON.parse(updated.groups_json || '[]')
    } catch {
      updated.groups = []
    }
    // Sync FTS
    upsertFtsIndex(
      updated.slug,
      updated.title,
      updated.markdown || '',
      updated.tags.join(' '),
      updated.category || ''
    )
  }

  return (updated as ConversionRecord) || null
}

export function getConversionById(id: number): ConversionRecord | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM conversions WHERE id = ?')
  const row = stmt.get(id) as any
  if (!row) return null
  try {
    row.tags = JSON.parse(row.tags_json || '[]')
  } catch {
    row.tags = []
  }
  try {
    row.groups = JSON.parse(row.groups_json || '[]')
  } catch {
    row.groups = []
  }
  return row as ConversionRecord
}

export function getConversionBySlug(slug: string): ConversionRecord | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM conversions WHERE slug = ? AND is_deleted = 0 LIMIT 1')
  const row = stmt.get(slug) as any
  if (!row) return null
  try {
    row.tags = JSON.parse(row.tags_json || '[]')
  } catch {
    row.tags = []
  }
  try {
    row.groups = JSON.parse(row.groups_json || '[]')
  } catch {
    row.groups = []
  }
  return row as ConversionRecord
}

export function getSetting(key: string): string | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT value FROM app_settings WHERE key = ?')
  const row = stmt.get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string): void {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `)
  stmt.run(key, value)
}

export function logExport(
  conversionId: number | undefined,
  target: 'github' | 'obsidian' | string,
  status: 'success' | 'failed',
  refOrPath?: string,
  errorMessage?: string
): void {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO export_logs (conversion_id, target, status, ref_or_path, error_message)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(conversionId ?? null, target, status, refOrPath ?? null, errorMessage ?? null)
}

export function getExportLogs(limit = 50): any[] {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM export_logs ORDER BY created_at DESC LIMIT ?')
  return stmt.all(limit)
}
