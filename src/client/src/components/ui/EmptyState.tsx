import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  readonly icon?: LucideIcon
  readonly title: string
  readonly description?: string
  readonly action?: React.ReactNode
  readonly className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl bg-surface-900/50 p-8 text-center',
        className,
      )}
    >
      {Icon && <Icon className="mb-3 h-10 w-10 text-surface-400" />}
      <h3 className="text-sm font-medium text-surface-300">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-surface-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
