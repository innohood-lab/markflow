import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { SidecarManager } from '../sidecar'

export interface DuplicateMatch {
  slug: string
  title: string
  score: number
}

export interface RelatedDocument {
  slug: string
  title: string
  score: number
  snippet: string
  groups?: string[]
}

export interface RecommendationResult {
  suggestedGroup: string | null
  groupConfidence: number
  suggestedTags: string[]
  isDuplicate: boolean
  duplicateMatch: DuplicateMatch | null
  relatedDocuments: RelatedDocument[]
}

interface CandidateDoc {
  slug: string
  title: string
  content: string
  groups: string[]
  tags: string[]
}

/**
 * Scan library markdown files to load candidates for AI similarity matching.
 */
export function getLibraryCandidates(libraryDir: string): CandidateDoc[] {
  const candidates: CandidateDoc[] = []
  if (!fs.existsSync(libraryDir)) return candidates

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
        const groups = Array.isArray(parsed.data.groups) ? parsed.data.groups : []
        const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags : []
        const fullContent = (title ? `${title}\n\n` : '') + (parsed.content || '')

        candidates.push({
          slug,
          title,
          content: fullContent,
          groups,
          tags
        })
      } catch {}
    }
  } catch (err) {
    console.warn('[AIRecommendationService] Error loading candidates:', err)
  }

  return candidates
}

/**
 * Fallback local tokenizer and trigram feature extractor for Node.js
 */
function extractFeatures(text: string): Map<string, number> {
  const features = new Map<string, number>()
  if (!text) return features

  // Strip frontmatter and markdown syntax
  let cleaned = text
  if (cleaned.startsWith('---')) {
    const parts = cleaned.split('---', 3)
    if (parts.length >= 3) cleaned = parts[2]
  }
  cleaned = cleaned
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, '$1 $2')
    .replace(/[#*_~=\->+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  // Words
  const words = cleaned.match(/[\w가-힣]+/g) || []
  for (const w of words) {
    if (w.length >= 2) {
      features.set(`w:${w}`, (features.get(`w:${w}`) || 0) + 1.5)
    }
  }

  // Character trigrams
  for (let i = 0; i < cleaned.length - 2; i++) {
    const tri = cleaned.substring(i, i + 3)
    if (!tri.includes(' ')) {
      features.set(`c:${tri}`, (features.get(`c:${tri}`) || 0) + 1.0)
    }
  }

  return features
}

function cosineSimilarity(map1: Map<string, number>, map2: Map<string, number>): number {
  if (map1.size === 0 || map2.size === 0) return 0.0

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (const [k, v] of map1) {
    norm1 += v * v
    if (map2.has(k)) {
      dotProduct += v * map2.get(k)!
    }
  }
  for (const v of map2.values()) {
    norm2 += v * v
  }

  if (norm1 === 0 || norm2 === 0) return 0.0
  return Math.min(1.0, Math.max(0.0, dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))))
}

/**
 * Execute similarity analysis with Python Sidecar or fallback to Node.js local engine.
 */
export async function getRecommendations(
  targetText: string,
  targetSlug: string | undefined,
  libraryDir: string,
  sidecar?: SidecarManager
): Promise<RecommendationResult> {
  const candidates = getLibraryCandidates(libraryDir)

  // Try Python Sidecar first if ready
  if (sidecar) {
    const status = sidecar.getStatus()
    if (status.state === 'ready' && status.port) {
      try {
        const secret = sidecar.getSecret?.()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (secret) {
          headers['X-Engine-Secret'] = secret
        }
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text: targetText,
            slug: targetSlug,
            candidates,
            top_k: 5,
            duplicate_threshold: 0.90
          })
        })
        if (res.ok) {
          const data = await res.json()
          return {
            suggestedGroup: data.suggested_group,
            groupConfidence: data.group_confidence,
            suggestedTags: data.suggested_tags || [],
            isDuplicate: !!data.is_duplicate,
            duplicateMatch: data.duplicate_match,
            relatedDocuments: data.related_documents || []
          }
        }
      } catch (err) {
        console.warn('[AIRecommendationService] Sidecar call failed, using Node.js fallback:', err)
      }
    }
  }

  // Node.js Fallback Engine
  const targetFeatures = extractFeatures(targetText)
  if (targetFeatures.size === 0) {
    return {
      suggestedGroup: null,
      groupConfidence: 0.0,
      suggestedTags: [],
      isDuplicate: false,
      duplicateMatch: null,
      relatedDocuments: []
    }
  }

  const scored: { score: number; cand: CandidateDoc }[] = []
  for (const cand of candidates) {
    if (targetSlug && cand.slug === targetSlug) continue
    const candFeatures = extractFeatures(cand.content || cand.title)
    const sim = cosineSimilarity(targetFeatures, candFeatures)
    if (sim > 0.05) {
      scored.push({ score: sim, cand })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  let isDuplicate = false
  let duplicateMatch: DuplicateMatch | null = null
  if (scored.length > 0 && scored[0].score >= 0.90) {
    isDuplicate = true
    duplicateMatch = {
      slug: scored[0].cand.slug,
      title: scored[0].cand.title,
      score: Math.round(scored[0].score * 1000) / 10
    }
  }

  const relatedDocuments: RelatedDocument[] = scored.slice(0, 5).map((item) => {
    const rawContent = item.cand.content.replace(/\s+/g, ' ').trim()
    const snippet = rawContent.length > 120 ? rawContent.substring(0, 120) + '...' : rawContent
    return {
      slug: item.cand.slug,
      title: item.cand.title,
      score: Math.round(item.score * 1000) / 10,
      snippet,
      groups: item.cand.groups
    }
  })

  // Group & Tag voting
  const groupVotes = new Map<string, number>()
  const tagVotes = new Map<string, number>()

  for (const item of scored.slice(0, 5)) {
    for (const g of item.cand.groups) {
      if (g) groupVotes.set(g, (groupVotes.get(g) || 0) + item.score)
    }
    for (const t of item.cand.tags) {
      if (t) tagVotes.set(t, (tagVotes.get(t) || 0) + item.score)
    }
  }

  let suggestedGroup: string | null = null
  let groupConfidence = 0.0
  if (groupVotes.size > 0) {
    const sortedGroups = Array.from(groupVotes.entries()).sort((a, b) => b[1] - a[1])
    const [topG, topScore] = sortedGroups[0]
    groupConfidence = Math.round(Math.min(99.0, topScore * 100) * 10) / 10
    if (groupConfidence >= 20.0) {
      suggestedGroup = topG
    }
  }

  const suggestedTags: string[] = []
  if (tagVotes.size > 0) {
    const sortedTags = Array.from(tagVotes.entries()).sort((a, b) => b[1] - a[1])
    for (const [t] of sortedTags.slice(0, 4)) {
      suggestedTags.push(t)
    }
  }

  return {
    suggestedGroup,
    groupConfidence,
    suggestedTags,
    isDuplicate,
    duplicateMatch,
    relatedDocuments
  }
}
