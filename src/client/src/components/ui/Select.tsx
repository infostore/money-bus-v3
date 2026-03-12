import * as React from 'react'
import { cn } from '../../lib/utils'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-black/[0.08] bg-white/80 backdrop-blur-md px-3 py-2 text-sm text-surface-800 ring-offset-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 focus:bg-white/90 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50',
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
