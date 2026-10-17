/**
 * MarkFlow Design Tokens
 * Follows Things-style simplicity, 8px grid hierarchy, and calm modern aesthetics.
 */

export const designTokens = {
  colors: {
    primary: {
      default: '#2563eb', // Calm Trust Blue
      hover: '#1d4ed8',
      light: '#eff6ff',
      dark: '#1e40af'
    },
    status: {
      success: '#10b981', // Engine Online
      error: '#ef4444',   // Engine Offline / Error
      warning: '#f59e0b', // Needs review
      info: '#3b82f6'
    },
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a'
    }
  },
  typography: {
    fontFamily: {
      sans: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    },
    sizes: {
      title: '26px', // Main page titles (Bold)
      subtitle: '15px', // Section / Subheader
      body: '14px', // Content / list text
      caption: '12px', // Badges, dates, hints
      tiny: '11px' // Metadata, status dots
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '10px',
    full: '9999px'
  },
  shadows: {
    subtle: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
    card: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
    floating: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)'
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)'
  }
}
