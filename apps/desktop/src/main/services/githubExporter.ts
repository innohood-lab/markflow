import * as fs from 'fs'
import * as path from 'path'
import { Octokit } from '@octokit/rest'
import { ConversionRecord, updateConversion, logExport } from '../db'
import { loadSettings } from './settingsService'

export interface GitHubExportResult {
  success: boolean
  commitSha?: string
  commitUrl?: string
  exportedCount: number
  message: string
  error?: string
}

/**
 * Enforce that the target base path is strictly inside `inbox/markflow/`
 * to protect ~/LLM-wiki on mac mini from conflicting with its 15-minute auto sync.
 */
export function sanitizeGitHubBasePath(rawPath: string): string {
  let clean = (rawPath || 'inbox/markflow/').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!clean.endsWith('/')) {
    clean += '/'
  }
  // Enforce isolation inside inbox/markflow/
  if (!clean.startsWith('inbox/markflow/')) {
    clean = 'inbox/markflow/' + clean
  }
  return clean
}

/**
 * Export multiple documents to GitHub LLM-wiki in a single atomic Git Data API commit.
 */
export async function exportDocumentsToGitHub(
  documents: ConversionRecord[],
  octokitClient?: Octokit // Optional injected Octokit for unit tests
): Promise<GitHubExportResult> {
  if (!documents || documents.length === 0) {
    return { success: false, exportedCount: 0, message: '내보낼 문서가 선택되지 않았습니다.' }
  }

  const settings = loadSettings(true)
  const token = settings.github.pat
  if (!token && !octokitClient) {
    return {
      success: false,
      exportedCount: 0,
      message: 'GitHub PAT 토큰이 설정되지 않았습니다. 설정 화면에서 PAT를 입력해주세요.'
    }
  }

  const owner = settings.github.owner || 'innohood-lab'
  const repo = settings.github.repo || 'LLM-wiki'
  const branch = settings.github.branch || 'main'
  const targetBasePath = sanitizeGitHubBasePath(settings.github.basePath)

  const octokit = octokitClient || new Octokit({ auth: token })

  try {
    // 1. Get latest commit SHA on target branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })
    const latestCommitSha = refData.object.sha

    // 2. Get base tree SHA from latest commit
    const { data: commitData } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha
    })
    const baseTreeSha = commitData.tree.sha

    // 3. Prepare Blobs and Tree Entries
    const treeItems: Array<{
      path: string
      mode: '100644' | '100755' | '040000' | '160000' | '120000'
      type: 'blob' | 'tree' | 'commit'
      sha: string
    }> = []

    for (const doc of documents) {
      if (!fs.existsSync(doc.library_path)) {
        console.warn(`[GitHubExport] Markdown file not found at ${doc.library_path}, skipping.`)
        continue
      }

      let content = fs.readFileSync(doc.library_path, 'utf-8')

      // Ensure exported.github is set to true in frontmatter
      if (content.includes('exported:')) {
        content = content.replace(/exported:\s*\{([^}]*)\}/, (_m, inner) => {
          if (inner.includes('github:')) {
            return `exported: {${inner.replace(/github:\s*(false|true)/, 'github: true')}}`
          }
          return `exported: {${inner ? inner + ', ' : ''}github: true}`
        })
      }

      // Create blob for Markdown file
      const { data: mdBlob } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content,
        encoding: 'utf-8'
      })

      treeItems.push({
        path: `${targetBasePath}${doc.slug}.md`,
        mode: '100644',
        type: 'blob',
        sha: mdBlob.sha
      })

      // Scan for associated assets in Library/assets/<slug>/
      const assetsDir = path.join(path.dirname(doc.library_path), 'assets', doc.slug)
      if (fs.existsSync(assetsDir)) {
        const assetFiles = fs.readdirSync(assetsDir)
        for (const assetFile of assetFiles) {
          const assetPath = path.join(assetsDir, assetFile)
          const stat = fs.statSync(assetPath)
          if (stat.isFile()) {
            const fileBuffer = fs.readFileSync(assetPath)
            const { data: assetBlob } = await octokit.rest.git.createBlob({
              owner,
              repo,
              content: fileBuffer.toString('base64'),
              encoding: 'base64'
            })

            treeItems.push({
              path: `${targetBasePath}assets/${doc.slug}/${assetFile}`,
              mode: '100644',
              type: 'blob',
              sha: assetBlob.sha
            })
          }
        }
      }
    }

    if (treeItems.length === 0) {
      return {
        success: false,
        exportedCount: 0,
        message: '업로드할 유효한 파일 또는 내용이 없습니다.'
      }
    }

    // 4. Create new tree based on baseTreeSha
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: treeItems
    })

    // 5. Create new commit
    const now = new Date()
    const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const commitMessage = `markflow: ${documents.length}개 문서 추가 (${dateFormatted})`

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha]
    })

    // 6. Update branch reference
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    })

    const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`

    // 7. Update database records & log export
    for (const doc of documents) {
      if (doc.id) {
        let exportedMeta: any = {}
        try {
          exportedMeta = JSON.parse(doc.exported_json || '{}')
        } catch {
          exportedMeta = {}
        }
        exportedMeta.github = true
        exportedMeta.github_commit = newCommit.sha
        exportedMeta.github_exported_at = now.toISOString()

        updateConversion(doc.id, {
          exported_json: JSON.stringify(exportedMeta),
          status: doc.status === 'inbox' || doc.status === 'ready' ? 'exported' : doc.status
        })

        logExport(doc.id, 'github', 'success', newCommit.sha)
      }
    }

    return {
      success: true,
      commitSha: newCommit.sha,
      commitUrl,
      exportedCount: documents.length,
      message: `성공적으로 GitHub LLM-wiki에 커밋 1개(${newCommit.sha.slice(0, 7)})로 업로드되었습니다.`
    }
  } catch (err: any) {
    console.error('[GitHubExport] Failed to export documents:', err)

    let errorMsg = '알 수 없는 네트워크 오류'
    if (err.status === 401) {
      errorMsg = 'GitHub PAT 토큰 인증 실패 (401 Unauthorized). 토큰 권한을 확인해주세요.'
    } else if (err.status === 403) {
      errorMsg = '저장소 쓰기 권한이 없거나 호출 한도 초과 (403 Forbidden).'
    } else if (err.status === 404) {
      errorMsg = `저장소 '${owner}/${repo}' 또는 브랜치 '${branch}'를 찾을 수 없습니다 (404 Not Found).`
    } else if (err.status === 409) {
      errorMsg = '원격 브랜치 참조 충돌 (409 Conflict). 잠시 후 다시 시도해주세요.'
    } else if (err.message) {
      errorMsg = err.message
    }

    for (const doc of documents) {
      if (doc.id) {
        logExport(doc.id, 'github', 'failed', undefined, errorMsg)
      }
    }

    return {
      success: false,
      exportedCount: 0,
      message: `GitHub 내보내기 실패: ${errorMsg}`,
      error: errorMsg
    }
  }
}
