import { useState, useEffect } from 'react'
import { LayoutDashboard, Settings } from 'lucide-react'
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
    <div className="flex h-screen bg-mesh">
      <aside className="flex w-56 flex-col border-r border-black/[0.06] bg-white/60 backdrop-blur-2xl">
        <div className="flex h-14 items-center px-6">
          <h1 className="bg-gradient-warm bg-clip-text text-lg font-bold text-transparent">
            Hono Local
          </h1>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
                view === id
                  ? 'bg-primary-500/10 text-primary-600 shadow-glow-sm'
                  : 'text-surface-500 hover:bg-black/[0.04] hover:text-surface-800',
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
  )
}
