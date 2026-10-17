import { describe, it, expect } from 'vitest'
import { designTokens } from '../src/renderer/src/tokens/design-tokens'

describe('MarkFlow Desktop Unit Tests', () => {
  it('should have valid design tokens defined', () => {
    expect(designTokens.colors.primary.default).toBe('#2563eb')
    expect(designTokens.colors.status.success).toBe('#10b981')
    expect(designTokens.typography.sizes.title).toBe('26px')
    expect(designTokens.borderRadius.lg).toBe('10px')
  })

  it('should have proper transitions configured for Things-style fluidity', () => {
    expect(designTokens.transitions.fast).toContain('150ms')
    expect(designTokens.transitions.normal).toContain('200ms')
  })
})
