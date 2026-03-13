// PRD-FEAT-013: ETF Component UI
import { Play, Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, Square } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useEtfScheduler } from './use-etf-scheduler'
import type { TaskExecution } from '@shared/types'

const STATUS_CONFIG: Record<
  TaskExecution['status'],
  { readonly label: string; readonly icon: typeof CheckCircle2; readonly className: string }
> = {
  running: { label: '실행 중', icon: Loader2, className: 'text-info-500' },
  success: { label: '성공', icon: CheckCircle2, className: 'text-success-500' },
  partial: { label: '부분 성공', icon: AlertTriangle, className: 'text-primary-500' },
  failed: { label: '실패', icon: XCircle, className: 'text-error-500' },
  aborted: { label: '중지됨', icon: Square, className: 'text-surface-400' },
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

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.className}`}>
      <Icon size={16} className={status === 'running' ? 'animate-spin' : ''} />
      {config.label}
    </span>
  )
}

interface ExecutionRowProps {
  readonly execution: TaskExecution
}

function ExecutionRow({ execution }: ExecutionRowProps) {
  return (
    <tr className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <StatusBadge status={execution.status} />
      </td>
      <td className="px-4 py-3 text-sm text-surface-400">
        {formatDateTime(execution.started_at)}
      </td>
      <td className="px-4 py-3 text-sm text-surface-400">
        {formatDuration(execution.started_at, execution.finished_at)}
      </td>
      <td className="px-4 py-3 text-sm text-right tabular-nums">
        <span className="text-success-500">{execution.products_succeeded}</span>
        {' / '}
        <span className="text-surface-300">{execution.products_total}</span>
      </td>
      <td className="px-4 py-3 text-sm text-right tabular-nums text-error-500">
        {execution.products_failed > 0 ? execution.products_failed : '-'}
      </td>
      <td className="px-4 py-3 text-sm text-right tabular-nums text-surface-500">
        {execution.products_skipped > 0 ? execution.products_skipped : '-'}
      </td>
      <td className="px-4 py-3 text-sm text-surface-500 max-w-[200px] truncate">
        {execution.message ?? '-'}
      </td>
    </tr>
  )
}

export function EtfSchedulerPage() {
  const {
    executions, loading, error, isRunning,
    triggerRun, runError,
    stopRun, isStopping, stopError,
  } = useEtfScheduler()

  const displayError = error ?? runError ?? stopError

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ETF 구성종목 수집 스케줄러</h1>
          <p className="mt-1 text-sm text-surface-500">
            매일 21:00 KST 자동 실행 · 최근 10건 실행 이력
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Button
              variant="secondary"
              onClick={() => stopRun()}
              disabled={isStopping}
              className="gap-1.5"
            >
              {isStopping ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  중지 중...
                </>
              ) : (
                <>
                  <Square size={16} />
                  중지
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => triggerRun()}
            disabled={isRunning}
            className="gap-1.5"
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                수집 중...
              </>
            ) : (
              <>
                <Play size={16} />
                수동 실행
              </>
            )}
          </Button>
        </div>
      </div>

      {displayError && (
        <div className="rounded-xl bg-error-500/10 border border-error-500/20 px-4 py-3 text-sm text-error-500">
          {displayError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-surface-500">
          <Loader2 size={24} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-surface-500">
          <Clock size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">실행 이력이 없습니다</p>
          <p className="mt-1 text-sm">수동 실행 버튼을 눌러 ETF 구성종목 수집을 시작하세요.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-surface-500">
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="px-4 py-3 text-left font-medium">시작 시간</th>
                <th className="px-4 py-3 text-left font-medium">소요 시간</th>
                <th className="px-4 py-3 text-right font-medium">성공 / 전체</th>
                <th className="px-4 py-3 text-right font-medium">실패</th>
                <th className="px-4 py-3 text-right font-medium">건너뜀</th>
                <th className="px-4 py-3 text-left font-medium">메시지</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => (
                <ExecutionRow key={exec.id} execution={exec} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
