import * as fs from 'fs'
import * as path from 'path'
import { ConversionRecord, updateConversion, logExport } from '../db'
import { loadSettings, validateObsidianVault } from './settingsService'

export interface ObsidianExportResult {
  success: boolean
  exportedCount: number
  targetPaths: string[]
  message: string
  error?: string
}

/**
 * Export multiple documents to the user's Obsidian Vault (iCloud Drive / local),
 * copying markdown files and attachments and rewriting image links to match Obsidian's structure.
 */
export async function exportDocumentsToObsidian(
  documents: ConversionRecord[],
  overrideVaultPath?: string // For unit tests
): Promise<ObsidianExportResult> {
  if (!documents || documents.length === 0) {
    return { success: false, exportedCount: 0, targetPaths: [], message: '내보낼 문서가 선택되지 않았습니다.' }
  }

  const settings = loadSettings(false)
  const vaultPath = overrideVaultPath || settings.obsidian.vaultPath

  // Validate vault path
  const validation = validateObsidianVault(vaultPath)
  if (!validation.valid) {
    return {
      success: false,
      exportedCount: 0,
      targetPaths: [],
      message: `Obsidian 볼트 확인 실패: ${validation.message}`,
      error: validation.message
    }
  }

  const inboxFolder = (settings.obsidian.inboxFolder || '00_Inbox/MarkFlow').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  const attachmentsFolder = (settings.obsidian.attachmentsFolder || 'attachments/MarkFlow').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')

  const targetInboxDir = path.join(vaultPath, inboxFolder)
  if (!fs.existsSync(targetInboxDir)) {
    fs.mkdirSync(targetInboxDir, { recursive: true })
  }

  const exportedTargetPaths: string[] = []
  const now = new Date()

  try {
    for (const doc of documents) {
      if (!fs.existsSync(doc.library_path)) {
        console.warn(`[ObsidianExport] Document file not found at ${doc.library_path}, skipping.`)
        continue
      }

      let content = fs.readFileSync(doc.library_path, 'utf-8')

      // Ensure exported.obsidian is set to true in frontmatter
      if (content.includes('exported:')) {
        content = content.replace(/exported:\s*\{([^}]*)\}/, (_m, inner) => {
          if (inner.includes('obsidian:')) {
            return `exported: {${inner.replace(/obsidian:\s*(false|true)/, 'obsidian: true')}}`
          }
          return `exported: {${inner ? inner + ', ' : ''}obsidian: true}`
        })
      }

      // Prepare target attachments folder: <vault>/attachments/MarkFlow/<slug>/
      const targetDocAttachmentsDir = path.join(vaultPath, attachmentsFolder, doc.slug)
      const sourceAssetsDir = path.join(path.dirname(doc.library_path), 'assets', doc.slug)

      if (fs.existsSync(sourceAssetsDir)) {
        if (!fs.existsSync(targetDocAttachmentsDir)) {
          fs.mkdirSync(targetDocAttachmentsDir, { recursive: true })
        }

        const assetFiles = fs.readdirSync(sourceAssetsDir)
        for (const assetFile of assetFiles) {
          const srcAsset = path.join(sourceAssetsDir, assetFile)
          const destAsset = path.join(targetDocAttachmentsDir, assetFile)
          if (fs.statSync(srcAsset).isFile()) {
            fs.copyFileSync(srcAsset, destAsset)
          }
        }
      }

      // Compute relative path from target markdown file directory to attachments folder
      // e.g. from <vault>/00_Inbox/MarkFlow to <vault>/attachments/MarkFlow/<slug>
      const relAttachments = path
        .relative(targetInboxDir, targetDocAttachmentsDir)
        .replace(/\\/g, '/')

      // Rewrite markdown image links: assets/<slug>/img-XXX.png -> ../../attachments/MarkFlow/<slug>/img-XXX.png
      const assetRegex = new RegExp(`assets/${doc.slug}/`, 'g')
      content = content.replace(assetRegex, `${relAttachments}/`)

      // Write markdown to Obsidian vault
      const targetMdPath = path.join(targetInboxDir, `${doc.slug}.md`)
      fs.writeFileSync(targetMdPath, content, 'utf-8')
      exportedTargetPaths.push(targetMdPath)

      // Update database record
      if (doc.id) {
        let exportedMeta: any = {}
        try {
          exportedMeta = JSON.parse(doc.exported_json || '{}')
        } catch {
          exportedMeta = {}
        }
        exportedMeta.obsidian = true
        exportedMeta.obsidian_exported_at = now.toISOString()
        exportedMeta.obsidian_path = targetMdPath

        updateConversion(doc.id, {
          exported_json: JSON.stringify(exportedMeta),
          status: doc.status === 'inbox' || doc.status === 'ready' ? 'exported' : doc.status
        })

        logExport(doc.id, 'obsidian', 'success', targetMdPath)
      }
    }

    return {
      success: true,
      exportedCount: exportedTargetPaths.length,
      targetPaths: exportedTargetPaths,
      message: `${exportedTargetPaths.length}개 문서가 Obsidian 보관함(${inboxFolder})으로 복사되었습니다.`
    }
  } catch (err: any) {
    console.error('[ObsidianExport] Failed to export to Obsidian:', err)
    const errorMsg = err.message || '알 수 없는 파일 복사 오류'

    for (const doc of documents) {
      if (doc.id) {
        logExport(doc.id, 'obsidian', 'failed', undefined, errorMsg)
      }
    }

    return {
      success: false,
      exportedCount: exportedTargetPaths.length,
      targetPaths: exportedTargetPaths,
      message: `Obsidian 내보내기 실패: ${errorMsg}`,
      error: errorMsg
    }
  }
}
