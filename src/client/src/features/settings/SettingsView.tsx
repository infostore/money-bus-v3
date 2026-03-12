import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { api } from '../../lib/api'

export function SettingsView() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await api.settings.getAll()
      setSettings(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim() || !value.trim()) return

    await api.settings.set(key.trim(), value.trim())
    setKey('')
    setValue('')
    await loadSettings()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Setting</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              placeholder="Key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : Object.keys(settings).length === 0 ? (
            <div className="py-8 text-center text-surface-500">
              No settings configured.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(settings).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-xl border border-black/[0.04] bg-white/40 px-4 py-3 transition-all duration-300 hover:bg-white/60"
                >
                  <span className="font-medium text-surface-800">{k}</span>
                  <span className="text-sm text-surface-500">{v}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
