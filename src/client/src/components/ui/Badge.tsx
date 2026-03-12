import * as React from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  readonly variant?: 'default' | 'success' | 'error' | 'warning' | 'outline'
}

const variants = {
  default: 'bg-primary-500/15 text-primary-400',
  success: 'bg-success-500/15 text-success-400',
  error: 'bg-error-500/15 text-error-400',
  warning: 'bg-primary-500/20 text-primary-300',
  outline: 'border border-surface-600 text-surface-400 bg-transparent',
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
