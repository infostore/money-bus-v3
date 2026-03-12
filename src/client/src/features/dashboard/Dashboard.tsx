import { useState } from 'react'
import { Package, DollarSign, Tags } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { MetricCard } from './MetricCard'
import { ItemList } from './ItemList'
import { useItems } from '../../hooks/use-items'

export function Dashboard() {
  const { items, summary, loading, error, createItem, deleteItem } = useItems()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !value.trim()) return

    await createItem({
      name: name.trim(),
      value: Number(value),
      category: category.trim() || undefined,
    })

    setName('')
    setValue('')
    setCategory('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error-200 bg-error-50 p-6 text-error-600">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="Total Items"
          value={summary?.total ?? 0}
          icon={Package}
        />
        <MetricCard
          title="Total Value"
          value={(summary?.totalValue ?? 0).toLocaleString()}
          icon={DollarSign}
          variant="mint"
        />
        <MetricCard
          title="Categories"
          value={summary?.categories.length ?? 0}
          icon={Tags}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32"
            />
            <Input
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-40"
            />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemList items={items} onDelete={deleteItem} />
        </CardContent>
      </Card>
    </div>
  )
}
