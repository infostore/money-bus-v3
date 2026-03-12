import { cn } from '../../lib/utils'

interface SpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg'
  readonly className?: string
}

const sizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-primary-500 border-t-transparent',
        sizes[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}
