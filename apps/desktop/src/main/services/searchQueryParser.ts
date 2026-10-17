export interface DateComparison {
  op: '>' | '<' | '>=' | '<=' | '='
  value: string
}

export interface ScoreComparison {
  op: '>' | '<' | '>=' | '<=' | '='
  value: number
}

export interface ParsedSearchQuery {
  terms: string[]
  phrases: string[]
  negations: string[]
  tags: string[]
  types: string[]
  statuses: string[]
  groups: string[]
  dateComparison?: DateComparison
  scoreComparison?: ScoreComparison
  exportedFilter?: boolean
  starredOnly?: boolean
  hasOrCondition?: boolean
  rawQuery: string
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const result: ParsedSearchQuery = {
    terms: [],
    phrases: [],
    negations: [],
    tags: [],
    types: [],
    statuses: [],
    groups: [],
    rawQuery: query
  }

  if (!query || !query.trim()) {
    return result
  }

  const raw = query.trim()
  // 1. Extract exact phrases in quotes: "exact words"
  const phraseRegex = /"([^"]+)"/g
  let match: RegExpExecArray | null
  const cleaned = raw.replace(phraseRegex, (_m, p1) => {
    result.phrases.push(p1.trim())
    return ' '
  })

  // 2. Tokenize remaining by whitespace
  const tokens = cleaned.split(/\s+/).filter(Boolean)

  for (const token of tokens) {
    if (token.toUpperCase() === 'OR') {
      result.hasOrCondition = true
      continue
    }

    // Negation: -word
    if (token.startsWith('-') && token.length > 1) {
      result.negations.push(token.substring(1))
      continue
    }

    // Field search: field:value
    const colonIndex = token.indexOf(':')
    if (colonIndex > 0) {
      const field = token.substring(0, colonIndex).toLowerCase()
      const val = token.substring(colonIndex + 1)

      if (field === 'tag') {
        result.tags.push(val)
        continue
      }
      if (field === 'type') {
        result.types.push(val.toLowerCase().replace(/^\./, ''))
        continue
      }
      if (field === 'status') {
        // Map common Korean status terms
        const statusMap: Record<string, string> = {
          수집함: 'inbox',
          대기: 'inbox',
          검토: 'review_needed',
          검토중: 'review_needed',
          검토필요: 'review_needed',
          완료: 'ready',
          준비완료: 'ready',
          보관: 'archived',
          보관됨: 'archived'
        }
        result.statuses.push(statusMap[val] || val)
        continue
      }
      if (field === 'group') {
        result.groups.push(val)
        continue
      }
      if (field === 'starred' || field === 'is') {
        if (val === 'starred' || val === 'true') {
          result.starredOnly = true
          continue
        }
      }
      if (field === 'exported') {
        if (val === 'false' || val === 'no' || val === 'none') {
          result.exportedFilter = false
        } else if (val === 'true' || val === 'yes') {
          result.exportedFilter = true
        }
        continue
      }
      if (field === 'date') {
        // e.g. date:>2026-09-01 or date:this_week
        if (val.toLowerCase() === 'this_week' || val === '이번주') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
          result.dateComparison = { op: '>=', value: sevenDaysAgo }
        } else if (val.toLowerCase() === 'today' || val === '오늘') {
          const today = new Date().toISOString().split('T')[0]
          result.dateComparison = { op: '>=', value: today }
        } else {
          const compMatch = val.match(/^(>=|<=|>|<|=)?(.+)$/)
          if (compMatch) {
            const op = (compMatch[1] as any) || '='
            result.dateComparison = { op, value: compMatch[2].trim() }
          }
        }
        continue
      }
      if (field === 'score') {
        // e.g. score:>=80 or score:<70
        const compMatch = val.match(/^(>=|<=|>|<|=)?(\d+)$/)
        if (compMatch) {
          const op = (compMatch[1] as any) || '='
          result.scoreComparison = { op, value: parseInt(compMatch[2], 10) }
        }
        continue
      }
    }

    // Default: free search term
    result.terms.push(token)
  }

  return result
}

/**
 * Build SQL WHERE conditions and params from parsed query.
 */
export function buildSqlFilterFromQuery(
  parsed: ParsedSearchQuery
): { whereClauses: string[]; params: Record<string, any> } {
  const whereClauses: string[] = []
  const params: Record<string, any> = {}

  // 1. Tags
  parsed.tags.forEach((t, i) => {
    const paramKey = `tag_${i}`
    whereClauses.push(`tags_json LIKE @${paramKey}`)
    params[paramKey] = `%"${t}"%`
  })

  // 2. Types
  if (parsed.types.length > 0) {
    const typePlaceholders = parsed.types
      .map((t, i) => {
        const paramKey = `type_${i}`
        params[paramKey] = t
        return `@${paramKey}`
      })
      .join(', ')
    whereClauses.push(`LOWER(source_type) IN (${typePlaceholders})`)
  }

  // 3. Statuses
  if (parsed.statuses.length > 0) {
    const statusPlaceholders = parsed.statuses
      .map((s, i) => {
        const paramKey = `status_${i}`
        params[paramKey] = s
        return `@${paramKey}`
      })
      .join(', ')
    whereClauses.push(`status IN (${statusPlaceholders})`)
  }

  // 4. Groups
  parsed.groups.forEach((g, i) => {
    const paramKey = `group_${i}`
    whereClauses.push(`groups_json LIKE @${paramKey}`)
    params[paramKey] = `%${g}%`
  })

  // 5. Starred
  if (parsed.starredOnly) {
    whereClauses.push('is_starred = 1')
  }

  // 6. Exported filter
  if (parsed.exportedFilter === false) {
    whereClauses.push(
      "(exported_json IS NULL OR exported_json = '{}' OR (exported_json NOT LIKE '%\"github\":true%' AND exported_json NOT LIKE '%\"obsidian\":true%'))"
    )
  } else if (parsed.exportedFilter === true) {
    whereClauses.push(
      "(exported_json LIKE '%\"github\":true%' OR exported_json LIKE '%\"obsidian\":true%')"
    )
  }

  // 7. Date comparison
  if (parsed.dateComparison) {
    const { op, value } = parsed.dateComparison
    whereClauses.push(`converted_at ${op} @date_comp`)
    params.date_comp = value
  }

  // 8. Score comparison
  if (parsed.scoreComparison) {
    const { op, value } = parsed.scoreComparison
    whereClauses.push(`quality_score IS NOT NULL AND quality_score ${op} @score_comp`)
    params.score_comp = value
  }

  // 9. Negations
  parsed.negations.forEach((neg, i) => {
    const paramKey = `neg_${i}`
    whereClauses.push(`(title NOT LIKE @${paramKey} AND markdown NOT LIKE @${paramKey})`)
    params[paramKey] = `%${neg}%`
  })

  // 10. Phrases
  parsed.phrases.forEach((ph, i) => {
    const paramKey = `phrase_${i}`
    whereClauses.push(`(title LIKE @${paramKey} OR markdown LIKE @${paramKey})`)
    params[paramKey] = `%${ph}%`
  })

  // 11. Text terms
  if (parsed.terms.length > 0) {
    if (parsed.hasOrCondition) {
      // OR terms
      const orClauses = parsed.terms.map((t, i) => {
        const paramKey = `or_term_${i}`
        params[paramKey] = `%${t}%`
        return `(title LIKE @${paramKey} OR markdown LIKE @${paramKey})`
      })
      whereClauses.push(`(${orClauses.join(' OR ')})`)
    } else {
      // AND terms
      parsed.terms.forEach((t, i) => {
        const paramKey = `term_${i}`
        params[paramKey] = `%${t}%`
        whereClauses.push(`(title LIKE @${paramKey} OR markdown LIKE @${paramKey})`)
      })
    }
  }

  return { whereClauses, params }
}
