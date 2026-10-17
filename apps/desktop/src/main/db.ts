import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { createRequire } from 'module'

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
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_conversions_converted_at ON conversions(converted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);
    CREATE INDEX IF NOT EXISTS idx_conversions_hash ON conversions(file_hash);

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

  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN profile TEXT DEFAULT 'balanced';`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN source_location TEXT;`)
  } catch {}
  try {
    db.exec(`ALTER TABLE conversions ADD COLUMN file_hash TEXT;`)
  } catch {}

  return db
}

export function saveConversion(record: ConversionRecord): ConversionRecord {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO conversions (
      slug, title, source_file, source_path, source_type, source_location, file_hash, file_size,
      converted_at, library_path, status, quality_score, profile, markdown, exported_json
    ) VALUES (
      @slug, @title, @source_file, @source_path, @source_type, @source_location, @file_hash, @file_size,
      @converted_at, @library_path, @status, @quality_score, @profile, @markdown, @exported_json
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
    exported_json: record.exported_json || '{}'
  })

  return { ...record, id: Number(info.lastInsertRowid) }
}

export function findConversionByHash(hash: string): ConversionRecord | null {
  if (!hash) return null
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM conversions WHERE file_hash = ? AND is_deleted = 0 LIMIT 1')
  return (stmt.get(hash) as ConversionRecord) || null
}

export function getConversions(params?: { search?: string; sort?: 'latest' | 'name'; reviewOnly?: boolean }): ConversionRecord[] {
  const database = getDatabase()
  let sql = 'SELECT * FROM conversions WHERE is_deleted = 0'
  const queryParams: any = {}

  if (params?.reviewOnly) {
    sql += " AND (status = 'review_needed' OR (quality_score IS NOT NULL AND quality_score < 70))"
  }

  if (params?.search && params.search.trim().length > 0) {
    sql += ' AND (title LIKE @search OR source_file LIKE @search)'
    queryParams.search = `%${params.search.trim()}%`
  }

  if (params?.sort === 'name') {
    sql += ' ORDER BY title ASC'
  } else {
    sql += ' ORDER BY converted_at DESC'
  }

  const stmt = database.prepare(sql)
  return stmt.all(queryParams) as ConversionRecord[]
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

  return item
}

export function restoreConversion(id: number): ConversionRecord | null {
  const database = getDatabase()
  const restoreStmt = database.prepare('UPDATE conversions SET is_deleted = 0 WHERE id = ?')
  restoreStmt.run(id)

  const findStmt = database.prepare('SELECT * FROM conversions WHERE id = ?')
  return (findStmt.get(id) as ConversionRecord) || null
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

  if (fields.length > 0) {
    const updateSql = `UPDATE conversions SET ${fields.join(', ')} WHERE id = @id`
    const stmt = database.prepare(updateSql)
    stmt.run(values)
  }

  return (findStmt.get(id) as ConversionRecord) || null
}

export function getConversionById(id: number): ConversionRecord | null {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM conversions WHERE id = ?')
  return (stmt.get(id) as ConversionRecord) || null
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
  target: 'github' | 'obsidian',
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

