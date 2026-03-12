import { Suspense } from 'react'
import {
  Outlet,
  Link,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  Package,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Settings,
  HelpCircle,
  Bell,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Spinner } from '../ui/Spinner'
import { useNavGroups } from './use-nav-groups'

interface NavItem {
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
  readonly path: string
}

interface NavGroup {
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
  readonly items: readonly NavItem[]
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'overview',
    label: '개요',
    icon: LayoutDashboard,
    items: [
      { id: 'dashboard', label: '대시보드', icon: LayoutDashboard, path: '/dashboard' },
    ],
  },
  {
    id: 'assets',
    label: '자산 관리',
    icon: Wallet,
    items: [
      { id: 'portfolio', label: '포트폴리오', icon: PieChart, path: '/portfolio' },
      { id: 'accounts', label: '계좌', icon: Wallet, path: '/accounts' },
      { id: 'products', label: '종목 관리', icon: Package, path: '/products' },
    ],
  },
  {
    id: 'analysis',
    label: '분석',
    icon: BarChart3,
    items: [
      { id: 'analysis', label: '종목 분석', icon: BarChart3, path: '/analysis' },
    ],
  },
  {
    id: 'planning',
    label: '재무 계획',
    icon: TrendingUp,
    items: [
      { id: 'planning', label: '재무 목표', icon: TrendingUp, path: '/planning' },
    ],
  },
  {
    id: 'tax',
    label: '세금',
    icon: ShieldCheck,
    items: [
      { id: 'tax', label: '세금 허브', icon: ShieldCheck, path: '/tax' },
    ],
  },
  {
    id: 'system',
    label: '시스템',
    icon: Settings,
    items: [
      { id: 'settings', label: '설정', icon: Settings, path: '/settings' },
      { id: 'help', label: '도움말', icon: HelpCircle, path: '/help' },
    ],
  },
]

function findGroupForPath(pathname: string): string {
  return NAV_GROUPS.find((g) =>
    g.items.some((i) => pathname.startsWith(i.path)),
  )?.id ?? 'overview'
}

export function AppLayout() {
  const { activeGroup, setActiveGroup } = useNavGroups()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const currentGroupId = activeGroup ?? findGroupForPath(currentPath)
  const currentGroup = NAV_GROUPS.find((g) => g.id === currentGroupId) ?? NAV_GROUPS[0]

  const handleGroupClick = (group: NavGroup) => {
    setActiveGroup(group.id)
  }

  return (
    <div className="flex h-screen flex-col bg-mesh">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.04] bg-surface-900/60 backdrop-blur-2xl px-6">
        <Link to="/dashboard" className="bg-gradient-warm bg-clip-text text-lg font-bold text-transparent">
          Money Bus
        </Link>
        <div className="flex items-center gap-1">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-white/[0.06] hover:text-surface-200">
            <Bell size={16} />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-white/[0.06] hover:text-surface-200">
            <User size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Icon Rail */}
        <nav className="flex w-14 shrink-0 flex-col items-center border-r border-white/[0.06] bg-surface-900/80 backdrop-blur-2xl py-3 gap-1 overflow-y-auto">
          <div className="mb-2 flex h-9 w-9 items-center justify-center">
            <span className="bg-gradient-warm bg-clip-text text-base font-bold text-transparent">
              M
            </span>
          </div>
          {NAV_GROUPS.map((group) => (
            <button
              key={group.id}
              onClick={() => handleGroupClick(group)}
              title={group.label}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                currentGroupId === group.id
                  ? 'bg-primary-500/20 text-primary-400 shadow-glow-sm'
                  : 'text-surface-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <group.icon size={20} />
            </button>
          ))}
        </nav>

        {/* Sub-menu Panel */}
        <aside className="flex w-48 shrink-0 flex-col border-r border-white/[0.04] bg-surface-900/40 backdrop-blur-2xl overflow-y-auto">
          <div className="flex h-12 items-center px-4">
            <span className="text-sm font-bold text-surface-200">{currentGroup.label}</span>
          </div>
          <nav className="flex-1 space-y-0.5 px-2 pb-3">
            {currentGroup.items.map(({ id, label, icon: Icon, path }) => (
              <Link
                key={id}
                to={path}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                  currentPath === path
                    ? 'bg-primary-500/15 text-primary-400 shadow-glow-sm'
                    : 'text-surface-400 hover:bg-white/[0.06] hover:text-surface-200',
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  )
}
