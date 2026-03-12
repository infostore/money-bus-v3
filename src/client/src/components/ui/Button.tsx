import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'error' | 'ghost'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary:
        'bg-gradient-warm text-white shadow-glow-sm hover:shadow-glow active:scale-[0.97]',
      secondary:
        'glass glass-hover text-surface-700',
      error: 'bg-error-500 text-white hover:bg-error-600 active:scale-[0.97]',
      ghost:
        'text-surface-500 hover:bg-black/[0.04] hover:text-surface-800',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button }
