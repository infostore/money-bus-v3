import * as React from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../../lib/utils'

interface AlertProps {
  readonly variant?: 'info' | 'success' | 'warning' | 'error'
  readonly title?: string
  readonly children: React.ReactNode
  readonly className?: string
}

const variants = {
  info: {
    container: 'bg-primary-50 border-primary-200 text-primary-800',
    icon: Info,
  },
  success: {
    container: 'bg-success-50 border-success-200 text-success-800',
    icon: CheckCircle,
  },
  warning: {
    container: 'bg-primary-50 border-primary-200 text-primary-800',
    icon: AlertTriangle,
  },
  error: {
    container: 'bg-error-50 border-error-200 text-error-800',
    icon: AlertCircle,
  },
}

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const config = variants[variant]
  const Icon = config.icon

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-xl border p-4',
        config.container,
        className,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        {title && <h4 className="mb-1 text-sm font-semibold">{title}</h4>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}
