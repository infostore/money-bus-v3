import { useState, useEffect } from 'react'
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
import { Dashboard } from './features/dashboard/Dashboard'
import { SettingsView } from './features/settings/SettingsView'
import { cn } from './lib/utils'

type View =
  | 'dashboard'
  | 'portfolio'
  | 'accounts'
  | 'products'
  | 'analysis'
  | 'planning'
  | 'tax'
  | 'settings'
  | 'help'

interface NavItem {
  readonly id: View
  readonly label: string
  readonly icon: LucideIcon
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
      { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    ],
  },
  {
    id: 'assets',
    label: '자산 관리',
    icon: Wallet,
    items: [
      { id: 'portfolio', label: '포트폴리오', icon: PieChart },
      { id: 'accounts', label: '계좌', icon: Wallet },
      { id: 'products', label: '종목 관리', icon: Package },
    ],
  },
  {
    id: 'analysis',
    label: '분석',
    icon: BarChart3,
    items: [
      { id: 'analysis', label: '종목 분석', icon: BarChart3 },
    ],
  },
  {
    id: 'planning',
    label: '재무 계획',
    icon: TrendingUp,
    items: [
      { id: 'planning', label: '재무 목표', icon: TrendingUp },
    ],
  },
  {
    id: 'tax',
    label: '세금',
    icon: ShieldCheck,
    items: [
      { id: 'tax', label: '세금 허브', icon: ShieldCheck },
    ],
  },
  {
    id: 'system',
    label: '시스템',
    icon: Settings,
    items: [
      { id: 'settings', label: '설정', icon: Settings },
      { id: 'help', label: '도움말', icon: HelpCircle },
    ],
  },
]

const VALID_VIEWS: readonly View[] = NAV_GROUPS.flatMap(g => g.items.map(i => i.id))
const IMPLEMENTED_VIEWS: ReadonlySet<View> = new Set(['dashboard', 'settings'])

function findGroupForView(view: View): string {
  return NAV_GROUPS.find(g => g.items.some(i => i.id === view))?.id ?? 'overview'
}

export function parseHashToView(hash: string): View {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const path = raw.split('?')[0]
  return VALID_VIEWS.includes(path as View) ? (path as View) : 'dashboard'
}

function getViewFromHash(): View {
  return parseHashToView(window.location.hash)
}

export function App() {
  const [view, setView] = useState<View>(getViewFromHash)
  const [activeGroup, setActiveGroup] = useState(() => findGroupForView(getViewFromHash()))

  useEffect(() => {
    const onHashChange = () => {
      const newView = getViewFromHash()
      setView(newView)
      setActiveGroup(findGroupForView(newView))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (id: View) => {
    if (!IMPLEMENTED_VIEWS.has(id)) return
    window.location.hash = id
  }

  const handleGroupClick = (group: NavGroup) => {
    setActiveGroup(group.id)
    const firstImplemented = group.items.find(i => IMPLEMENTED_VIEWS.has(i.id))
    if (firstImplemented) {
      navigate(firstImplemented.id)
    }
  }

  const currentGroup = NAV_GROUPS.find(g => g.id === activeGroup) ?? NAV_GROUPS[0]

  return (
    <div className="flex h-screen flex-col bg-mesh">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.04] bg-surface-900/60 backdrop-blur-2xl px-6">
        <h1 className="bg-gradient-warm bg-clip-text text-lg font-bold text-transparent">
          Money Bus
        </h1>
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
                activeGroup === group.id
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
            {currentGroup.items.map(({ id, label, icon: Icon }) => {
              const implemented = IMPLEMENTED_VIEWS.has(id)
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  disabled={!implemented}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                    !implemented && 'opacity-30 cursor-not-allowed',
                    view === id
                      ? 'bg-primary-500/15 text-primary-400 shadow-glow-sm'
                      : 'text-surface-400 hover:bg-white/[0.06] hover:text-surface-200',
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          {view === 'dashboard' && <Dashboard />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
