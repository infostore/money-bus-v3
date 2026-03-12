import * as React from 'react'
import { cn } from '../../lib/utils'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-white/[0.08] bg-surface-950/60 backdrop-blur-md px-3 py-2 text-sm text-surface-200 ring-offset-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 focus:bg-surface-950/80 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

export { Select }
