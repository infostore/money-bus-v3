import { Card, CardContent } from '../../components/ui/Card'
import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  readonly title: string
  readonly value: string | number
  readonly icon: LucideIcon
  readonly variant?: 'default' | 'mint'
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-500">{title}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-2xl backdrop-blur-sm',
              variant === 'mint'
                ? 'bg-mint-500/15 text-mint-600 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                : 'bg-primary-500/15 text-primary-600 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
            )}
          >
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
