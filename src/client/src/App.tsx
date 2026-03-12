import { useState, useEffect } from 'react'
import { LayoutDashboard, Settings, Bell, User } from 'lucide-react'
import { Dashboard } from './features/dashboard/Dashboard'
import { SettingsView } from './features/settings/SettingsView'
import { cn } from './lib/utils'

type View = 'dashboard' | 'settings'

const VALID_VIEWS: readonly View[] = ['dashboard', 'settings']

export function parseHashToView(hash: string): View {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const path = raw.split('?')[0]
  return VALID_VIEWS.includes(path as View) ? (path as View) : 'dashboard'
}

function getViewFromHash(): View {
  return parseHashToView(window.location.hash)
}

const NAV_ITEMS: readonly { readonly id: View; readonly label: string; readonly icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function App() {
  const [view, setView] = useState<View>(getViewFromHash)

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (id: View) => {
    window.location.hash = id
  }

  return (
    <div className="flex h-screen flex-col bg-mesh">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.04] bg-surface-900/60 backdrop-blur-2xl px-6">
        <h1 className="bg-gradient-warm bg-clip-text text-lg font-bold text-transparent">
          Money Bus
        </h1>
        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-400 transition-colors hover:bg-white/[0.06] hover:text-surface-200">
            <Bell size={18} />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-400 transition-colors hover:bg-white/[0.06] hover:text-surface-200">
            <User size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.04] bg-surface-900/40 backdrop-blur-2xl">
          <nav className="flex-1 space-y-1 px-3 py-3">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
                  view === id
                    ? 'bg-primary-500/15 text-primary-400 shadow-glow-sm'
                    : 'text-surface-400 hover:bg-white/[0.04] hover:text-surface-200',
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
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
