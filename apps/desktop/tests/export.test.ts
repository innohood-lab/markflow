import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Mock db to decouple unit tests from native SQLite bindings in Node environment
vi.mock('../src/main/db', () => ({
  getDatabase: vi.fn(),
  getSetting: vi.fn().mockReturnValue(null),
  setSetting: vi.fn(),
  updateConversion: vi.fn(),
  logExport: vi.fn(),
  getExportLogs: vi.fn().mockReturnValue([])
}))

import {
  sanitizeGitHubBasePath,
  exportDocumentsToGitHub
} from '../src/main/services/githubExporter'
import {
  encryptSecret,
  decryptSecret,
  maskPat,
  validateObsidianVault
} from '../src/main/services/settingsService'
import { exportDocumentsToObsidian } from '../src/main/services/obsidianExporter'

describe('Phase 5: Exporting & Settings Unit Tests', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-export-test-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  describe('Security & Settings Helper Tests', () => {
    it('should encrypt and decrypt secrets cleanly', () => {
      const secret = 'ghp_secretToken1234567890abcdef'
      const encrypted = encryptSecret(secret)
      expect(encrypted).not.toBe(secret)
      expect(encrypted.startsWith('enc:') || encrypted.startsWith('b64:')).toBe(true)

      const decrypted = decryptSecret(encrypted)
      expect(decrypted).toBe(secret)
    })

    it('should mask PAT tokens safely for UI display', () => {
      const shortToken = 'ghp_1234'
      expect(maskPat(shortToken)).toBe('ghp_••••')

      const standardToken = 'ghp_1234567890abcdef'
      const masked = maskPat(standardToken)
      expect(masked.startsWith('ghp_')).toBe(true)
      expect(masked.endsWith('cdef')).toBe(true)
      expect(masked.includes('•')).toBe(true)
      expect(masked).not.toContain('1234567890')
    })

    it('should enforce LLM-wiki base path constraint inside inbox/markflow/', () => {
      expect(sanitizeGitHubBasePath('')).toBe('inbox/markflow/')
      expect(sanitizeGitHubBasePath('inbox/markflow/')).toBe('inbox/markflow/')
      expect(sanitizeGitHubBasePath('inbox/markflow/custom/')).toBe('inbox/markflow/custom/')
      // Path outside must be prefixed with inbox/markflow/
      expect(sanitizeGitHubBasePath('wiki/pages/')).toBe('inbox/markflow/wiki/pages/')
      expect(sanitizeGitHubBasePath('\\inbox\\markflow\\test')).toBe('inbox/markflow/test/')
    })

    it('should accurately validate Obsidian vault paths', () => {
      expect(validateObsidianVault('')).toEqual({
        valid: false,
        message: 'Obsidian 볼트 경로가 설정되지 않았습니다.'
      })

      const invalidPath = path.join(tempDir, 'non_existent_folder')
      expect(validateObsidianVault(invalidPath)).toEqual({
        valid: false,
        message: '지정한 볼트 경로가 존재하지 않습니다.'
      })

      const folderNoObsidian = path.join(tempDir, 'plain_folder')
      fs.mkdirSync(folderNoObsidian, { recursive: true })
      expect(validateObsidianVault(folderNoObsidian).valid).toBe(false)

      const validVault = path.join(tempDir, 'my_vault')
      fs.mkdirSync(path.join(validVault, '.obsidian'), { recursive: true })
      expect(validateObsidianVault(validVault)).toEqual({
        valid: true,
        message: '유효한 Obsidian 볼트입니다.'
      })
    })
  })

  describe('Obsidian Vault Exporter Tests', () => {
    it('should copy markdown and assets and rewrite relative links properly', async () => {
      // 1. Create a mock Obsidian vault
      const vaultPath = path.join(tempDir, 'vault')
      fs.mkdirSync(path.join(vaultPath, '.obsidian'), { recursive: true })

      // 2. Create mock Library structure
      const libraryDir = path.join(tempDir, 'Library')
      const assetsDir = path.join(libraryDir, 'assets', 'sample-doc')
      fs.mkdirSync(assetsDir, { recursive: true })

      const mockImgPath = path.join(assetsDir, 'img-001.png')
      fs.writeFileSync(mockImgPath, 'PNG_DATA_PLACEHOLDER')

      const mockMdPath = path.join(libraryDir, 'sample-doc.md')
      const originalMd = `---
title: "샘플 보고서"
source_file: "샘플.pdf"
source_type: "pdf"
converted_at: "2026-10-17T12:00:00"
tags: ["보고서", "AX"]
exported: { github: false, obsidian: false }
---

# 샘플 보고서

이 보고서에는 이미지가 포함되어 있습니다:
![도식](assets/sample-doc/img-001.png)
`
      fs.writeFileSync(mockMdPath, originalMd, 'utf-8')

      // 3. Run exportDocumentsToObsidian
      const mockDoc: any = {
        id: 999,
        slug: 'sample-doc',
        title: '샘플 보고서',
        library_path: mockMdPath,
        status: 'inbox',
        exported_json: '{}'
      }

      const result = await exportDocumentsToObsidian([mockDoc], vaultPath)

      expect(result.success).toBe(true)
      expect(result.exportedCount).toBe(1)

      // 4. Verify target markdown exists in vault
      const targetMdPath = path.join(vaultPath, '00_Inbox', 'MarkFlow', 'sample-doc.md')
      expect(fs.existsSync(targetMdPath)).toBe(true)

      // 5. Verify target asset image was copied
      const targetImgPath = path.join(vaultPath, 'attachments', 'MarkFlow', 'sample-doc', 'img-001.png')
      expect(fs.existsSync(targetImgPath)).toBe(true)
      expect(fs.readFileSync(targetImgPath, 'utf-8')).toBe('PNG_DATA_PLACEHOLDER')

      // 6. Verify image link was rewritten with relative path
      const exportedContent = fs.readFileSync(targetMdPath, 'utf-8')
      expect(exportedContent).toContain('obsidian: true')
      expect(exportedContent).toContain('../../attachments/MarkFlow/sample-doc/img-001.png')
      expect(exportedContent).not.toContain('assets/sample-doc/img-001.png')
    })
  })

  describe('GitHub Git Data API Exporter Tests', () => {
    it('should bundle multiple files into 1 atomic commit with base tree and blobs', async () => {
      // Create mock library markdown
      const libraryDir = path.join(tempDir, 'Library')
      const assetsDir = path.join(libraryDir, 'assets', 'git-test-doc')
      fs.mkdirSync(assetsDir, { recursive: true })

      const imgPath = path.join(assetsDir, 'img-001.png')
      fs.writeFileSync(imgPath, 'MOCK_IMAGE_DATA')

      const mdPath = path.join(libraryDir, 'git-test-doc.md')
      fs.writeFileSync(
        mdPath,
        `---
title: "GitHub 테스트"
exported: { github: false }
---
# GitHub 테스트
![이미지](assets/git-test-doc/img-001.png)
`,
        'utf-8'
      )

      // Mock Octokit instance
      const createdBlobs: Array<{ content: string; encoding: string }> = []
      let createdTree: any = null
      let createdCommit: any = null
      let updatedRef: any = null

      const mockOctokit: any = {
        rest: {
          git: {
            getRef: vi.fn().mockResolvedValue({
              data: { object: { sha: 'base_commit_sha_123' } }
            }),
            getCommit: vi.fn().mockResolvedValue({
              data: { tree: { sha: 'base_tree_sha_456' } }
            }),
            createBlob: vi.fn().mockImplementation(async ({ content, encoding }) => {
              createdBlobs.push({ content, encoding })
              return { data: { sha: `blob_sha_${createdBlobs.length}` } }
            }),
            createTree: vi.fn().mockImplementation(async ({ base_tree, tree }) => {
              createdTree = { base_tree, tree }
              return { data: { sha: 'new_tree_sha_789' } }
            }),
            createCommit: vi.fn().mockImplementation(async ({ message, tree, parents }) => {
              createdCommit = { message, tree, parents }
              return { data: { sha: 'new_commit_sha_abc' } }
            }),
            updateRef: vi.fn().mockImplementation(async ({ ref, sha }) => {
              updatedRef = { ref, sha }
              return { data: { object: { sha } } }
            })
          }
        }
      }

      const mockDoc: any = {
        id: 888,
        slug: 'git-test-doc',
        title: 'GitHub 테스트',
        library_path: mdPath,
        status: 'inbox',
        exported_json: '{}'
      }

      const result = await exportDocumentsToGitHub([mockDoc], mockOctokit)

      expect(result.success).toBe(true)
      expect(result.commitSha).toBe('new_commit_sha_abc')
      expect(result.commitUrl).toContain('innohood-lab/LLM-wiki/commit/new_commit_sha_abc')

      // Check Blobs: 1 for markdown, 1 for image
      expect(createdBlobs.length).toBe(2)

      // Check Tree entries: both are strictly under inbox/markflow/
      expect(createdTree.tree.length).toBe(2)
      expect(createdTree.tree[0].path).toBe('inbox/markflow/git-test-doc.md')
      expect(createdTree.tree[1].path).toBe('inbox/markflow/assets/git-test-doc/img-001.png')

      // Check Commit: 1 commit with parents [base_commit_sha_123]
      expect(createdCommit.parents).toEqual(['base_commit_sha_123'])
      expect(createdCommit.message).toContain('markflow: 1개 문서 추가')

      // Check Ref updated to heads/main with new commit SHA
      expect(updatedRef).toEqual({
        ref: 'heads/main',
        sha: 'new_commit_sha_abc'
      })
    })
  })
})
