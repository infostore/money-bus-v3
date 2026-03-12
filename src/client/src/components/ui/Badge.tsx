import * as React from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly variant?: 'default' | 'success' | 'error' | 'warning' | 'outline'
}

const variants = {
  default: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  error: 'bg-error-50 text-error-700',
  warning: 'bg-primary-100 text-primary-800',
  outline: 'border border-surface-200 text-surface-600 bg-transparent',
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
)
Badge.displayName = 'Badge'

export { Badge }
export type { BadgeProps }
