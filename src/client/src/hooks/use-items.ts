import { useState, useEffect, useCallback } from 'react'
import type { ItemData, ItemSummary, CreateItemPayload } from '@shared/types'
import { api } from '../lib/api'

interface UseItemsResult {
  readonly items: ItemData[]
  readonly summary: ItemSummary | null
  readonly loading: boolean
  readonly error: string | null
  readonly createItem: (input: CreateItemPayload) => Promise<void>
  readonly deleteItem: (id: number) => Promise<void>
  readonly refresh: () => void
}

export function useItems(): UseItemsResult {
  const [items, setItems] = useState<ItemData[]>([])
  const [summary, setSummary] = useState<ItemSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  const refresh = useCallback(() => setTrigger((t) => t + 1), [])

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([api.items.list(), api.items.summary()])
      .then(([itemList, itemSummary]) => {
        setItems(itemList)
        setSummary(itemSummary)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [trigger])

  const createItem = useCallback(
    async (input: CreateItemPayload) => {
      await api.items.create(input)
      refresh()
    },
    [refresh],
  )

  const deleteItem = useCallback(
    async (id: number) => {
      await api.items.delete(id)
      refresh()
    },
    [refresh],
  )

  return { items, summary, loading, error, createItem, deleteItem, refresh }
}
