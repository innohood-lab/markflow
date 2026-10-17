import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  getLibraryCandidates,
  getRecommendations
} from '../src/main/services/aiRecommendationService'

describe('Phase 8-(다): AI Recommendations & Duplicate Detection Service', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-ai-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('getLibraryCandidates', () => {
    it('should load candidates with frontmatter groups and tags', () => {
      const docPath = path.join(tempDir, 'sample-1.md')
      fs.writeFileSync(
        docPath,
        `---\ntitle: "AI Architecture"\ngroups: ["연구/AI"]\ntags: ["ML", "System"]\n---\n# Content\nDeep neural network deployment.`,
        'utf-8'
      )

      const candidates = getLibraryCandidates(tempDir)
      expect(candidates).toHaveLength(1)
      expect(candidates[0].slug).toBe('sample-1')
      expect(candidates[0].title).toBe('AI Architecture')
      expect(candidates[0].groups).toEqual(['연구/AI'])
      expect(candidates[0].tags).toEqual(['ML', 'System'])
      expect(candidates[0].content).toContain('Deep neural network deployment.')
    })
  })

  describe('getRecommendations', () => {
    it('should detect duplicate document when similarity is 90% or higher', async () => {
      // Existing Document in library
      const existingDoc = path.join(tempDir, 'existing-research.md')
      fs.writeFileSync(
        existingDoc,
        `---\ntitle: "인공지능 대형 언어 모델 파인튜닝 연구 보고서"\ngroups: ["연구/LLM"]\ntags: ["LLM", "FineTuning"]\n---\n대형 언어 모델의 파인튜닝 기법과 양자화 최적화에 대한 상세 연구 분석 보고서입니다.`,
        'utf-8'
      )

      // Incoming almost identical text
      const newText = `인공지능 대형 언어 모델 파인튜닝 연구 보고서\n\n대형 언어 모델의 파인튜닝 기법과 양자화 최적화에 대한 상세 연구 분석 보고서입니다.`

      const result = await getRecommendations(newText, 'incoming-doc', tempDir)

      expect(result.isDuplicate).toBe(true)
      expect(result.duplicateMatch).not.toBeNull()
      expect(result.duplicateMatch?.slug).toBe('existing-research')
      expect(result.duplicateMatch?.score).toBeGreaterThanOrEqual(90)
    })

    it('should suggest accurate group and tags based on similar library documents', async () => {
      // 2 Documents belonging to "업무/기획"
      fs.writeFileSync(
        path.join(tempDir, 'plan-1.md'),
        `---\ntitle: "2026 모바일 앱 신규 기획안"\ngroups: ["업무/기획"]\ntags: ["기획", "모바일"]\n---\n모바일 앱 UX 디자인 및 사용자 경험 개선 기획 요구사항 정의서.`,
        'utf-8'
      )
      fs.writeFileSync(
        path.join(tempDir, 'plan-2.md'),
        `---\ntitle: "앱 사용자 피드백 분석 기획"\ngroups: ["업무/기획"]\ntags: ["기획", "피드백"]\n---\n모바일 앱 신규 기능 배포 후 사용자 경험 및 피드백 개선 기획.`,
        'utf-8'
      )

      // 1 Document in different group
      fs.writeFileSync(
        path.join(tempDir, 'recipe.md'),
        `---\ntitle: "주말 요리 레시피"\ngroups: ["개인/요리"]\ntags: ["요리"]\n---\n맛있는 된장찌개 끓이는 방법 재료 준비.`,
        'utf-8'
      )

      const targetText = `모바일 앱 신규 사용자 경험 개선 기획 회의록`
      const result = await getRecommendations(targetText, 'new-meeting-doc', tempDir)

      // Suggested group should be "업무/기획"
      expect(result.suggestedGroup).toBe('업무/기획')
      expect(result.groupConfidence).toBeGreaterThanOrEqual(20.0)

      // Suggested tags should contain "기획" or "모바일"
      expect(result.suggestedTags).toContain('기획')

      // Related documents should rank plan-1 or plan-2 first
      expect(result.relatedDocuments.length).toBeGreaterThanOrEqual(2)
      const topSlugs = result.relatedDocuments.map((r) => r.slug)
      expect(topSlugs).toContain('plan-1')
      expect(topSlugs).toContain('plan-2')
      expect(topSlugs).not.toContain('recipe')
    })

    it('should return empty suggestions for non-matching isolated text', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'physics.md'),
        `---\ntitle: "양자역학 기초"\ngroups: ["과학/물리"]\n---\n슈뢰딩거 파동 방정식과 하이젠베르크 불확정성 원리.`,
        'utf-8'
      )

      const isolatedText = `오늘 저녁에는 맛있는 파스타를 요리해서 먹었다.`
      const result = await getRecommendations(isolatedText, 'dinner-log', tempDir)

      expect(result.isDuplicate).toBe(false)
      expect(result.duplicateMatch).toBeNull()
      expect(result.relatedDocuments).toHaveLength(0)
    })
  })
})
