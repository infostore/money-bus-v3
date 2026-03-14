// PRD-FEAT-018: Scheduler Execution Detail
import { useParams, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, XCircle, Square, Clock, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useExecutionDetail } from './use-execution-detail'
import type { TaskExecution, TaskExecutionDetail } from '@shared/types'

const EXECUTION_STATUS_CONFIG: Record<
  TaskExecution['status'],
  { readonly label: string; readonly icon: typeof CheckCircle2; readonly className: string }
> = {
  running: { label: '실행 중', icon: Loader2, className: 'text-info-500' },
  success: { label: '성공', icon: CheckCircle2, className: 'text-success-500' },
  partial: { label: '부분 성공', icon: AlertTriangle, className: 'text-primary-500' },
  failed: { label: '실패', icon: XCircle, className: 'text-error-500' },
  aborted: { label: '중지됨', icon: Square, className: 'text-surface-400' },
}

const DETAIL_STATUS_CONFIG: Record<
  TaskExecutionDetail['status'],
  { readonly label: string; readonly icon: typeof CheckCircle2; readonly className: string }
> = {
  success: { label: '성공', icon: CheckCircle2, className: 'text-success-500' },
  failed: { label: '실패', icon: XCircle, className: 'text-error-500' },
  skipped: { label: '건너뜀', icon: AlertCircle, className: 'text-surface-400' },
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '-'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}초`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return `${minutes}분 ${remainSeconds}초`
}

interface StatusBadgeProps {
  readonly status: TaskExecution['status']
}

function ExecutionStatusBadge({ status }: StatusBadgeProps) {
  const config = EXECUTION_STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.className}`}>
      <Icon size={16} className={status === 'running' ? 'animate-spin' : ''} />
      {config.label}
    </span>
  )
}

interface DetailStatusBadgeProps {
  readonly status: TaskExecutionDetail['status']
}

function DetailStatusBadge({ status }: DetailStatusBadgeProps) {
  const config = DETAIL_STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.className}`}>
      <Icon size={14} />
      {config.label}
    </span>
  )
}

export function ExecutionDetailPage() {
  const { executionId } = useParams({ from: '/scheduler/executions/$executionId' })
  const navigate = useNavigate()
  const id = Number(executionId)
  const goBack = () => navigate({ to: '/scheduler/price-collection' })

  if (isNaN(id)) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={goBack} className="gap-1.5">
          <ArrowLeft size={16} />
          돌아가기
        </Button>
        <div className="text-surface-500 text-center py-16">잘못된 실행 ID입니다.</div>
      </div>
    )
  }

  const { execution, details, loading, error } = useExecutionDetail(id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-surface-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        불러오는 중...
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={goBack} className="gap-1.5">
          <ArrowLeft size={16} />
          돌아가기
        </Button>
        <div className="rounded-xl bg-error-500/10 border border-error-500/20 px-4 py-3 text-sm text-error-500">
          {error}
        </div>
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={goBack} className="gap-1.5">
          <ArrowLeft size={16} />
          돌아가기
        </Button>
        <div className="text-surface-500 text-center py-16">실행 이력을 찾을 수 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={goBack}
          className="gap-1.5"
        >
          <ArrowLeft size={16} />
          돌아가기
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">실행 상세</h1>
          <p className="text-sm text-surface-500">실행 #{execution.id}</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="glass rounded-2xl p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-surface-500 mb-1">상태</p>
            <ExecutionStatusBadge status={execution.status} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-surface-500 mb-1">시작 시간</p>
            <p className="text-sm">{formatDateTime(execution.started_at)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-surface-500 mb-1">소요 시간</p>
            <p className="text-sm">{formatDuration(execution.started_at, execution.finished_at)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-surface-500 mb-1">결과</p>
            <p className="text-sm tabular-nums">
              <span className="text-success-500">{execution.products_succeeded}</span>
              {' / '}
              <span className="text-surface-300">{execution.products_total}</span>
              {execution.products_failed > 0 && (
                <span className="text-error-500 ml-2">실패 {execution.products_failed}</span>
              )}
              {execution.products_skipped > 0 && (
                <span className="text-surface-500 ml-2">건너뜀 {execution.products_skipped}</span>
              )}
            </p>
          </div>
        </div>
        {execution.message && (
          <div className="mt-4 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-surface-400">
            {execution.message}
          </div>
        )}
      </div>

      {/* Detail Table */}
      {details.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-surface-500">
          <Clock size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">상세 이력이 없습니다</p>
          <p className="mt-1 text-sm">이 실행에 대한 개별 항목 결과가 기록되지 않았습니다.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-surface-500">
                <th className="px-4 py-3 text-left font-medium w-12">#</th>
                <th className="px-4 py-3 text-left font-medium">상품</th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="px-4 py-3 text-left font-medium">메시지</th>
              </tr>
            </thead>
            <tbody>
              {details.map((detail, idx) => (
                <tr
                  key={detail.id}
                  className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-surface-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm">
                    {detail.product_name ? (
                      <span>
                        {detail.product_name}
                        {detail.product_code && (
                          <span className="text-surface-500 ml-1.5">({detail.product_code})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-surface-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DetailStatusBadge status={detail.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-400 max-w-[300px] truncate">
                    {detail.message ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
