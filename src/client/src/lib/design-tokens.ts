/**
 * Design Token Constants
 *
 * Centralized style constants for semantic colors, chart palettes,
 * and visual mappings. All values use Tailwind tokens defined in
 * tailwind.config.js.
 */

export const SEMANTIC_COLORS = {
  positive: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    border: 'border-success-200',
  },
  negative: {
    bg: 'bg-error-50',
    text: 'text-error-700',
    border: 'border-error-200',
  },
  warning: {
    bg: 'bg-primary-50',
    text: 'text-primary-800',
    border: 'border-primary-200',
  },
  neutral: {
    bg: 'bg-surface-50',
    text: 'text-surface-700',
    border: 'border-surface-200',
  },
} as const

export const CHART_COLORS = {
  primary: '#f97316',
  mint: '#34d399',
  error: '#f43f5e',
  success: '#10b981',
  info: '#3b82f6',
  surface: '#78716c',
} as const

export const CHART_COLOR_ARRAY = [
  CHART_COLORS.primary,
  CHART_COLORS.mint,
  CHART_COLORS.error,
  CHART_COLORS.success,
  CHART_COLORS.surface,
] as const

export const CATEGORY_BADGE_COLORS = [
  { bg: 'bg-primary-50', text: 'text-primary-600' },
  { bg: 'bg-coral-300/20', text: 'text-coral-600' },
  { bg: 'bg-mint-300/20', text: 'text-mint-600' },
  { bg: 'bg-success-50', text: 'text-success-600' },
  { bg: 'bg-error-50', text: 'text-error-600' },
  { bg: 'bg-surface-100', text: 'text-surface-600' },
] as const

type SemanticColorSet = {
  readonly bg: string
  readonly text: string
  readonly border: string
}

export function getSemanticColor(value: number): SemanticColorSet {
  if (value > 0) return SEMANTIC_COLORS.positive
  if (value < 0) return SEMANTIC_COLORS.negative
  return SEMANTIC_COLORS.neutral
}

export function getValueColorClass(value: number): string {
  if (value > 0) return 'text-success-600'
  if (value < 0) return 'text-error-600'
  return 'text-surface-600'
}
