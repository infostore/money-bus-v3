// PRD-FEAT-013: ETF Component UI
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { EtfComponent } from '@shared/types'

const ETF_DATES_KEY = (productId: number) => ['etf-component-dates', productId] as const
const ETF_COMPONENTS_KEY = (productId: number, date: string) =>
  ['etf-components', productId, date] as const

export function useEtfHoldings(productId: number) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const {
    data: dates = [],
    isLoading: datesLoading,
    error: datesError,
  } = useQuery({
    queryKey: ETF_DATES_KEY(productId),
    queryFn: () => api.etfComponents.getDates(productId),
    enabled: productId > 0,
  })

  // Auto-select most recent date when dates load
  useEffect(() => {
    if (dates.length > 0 && selectedDate === null) {
      setSelectedDate(dates[0]!)
    }
  }, [dates, selectedDate])

  const {
    data: components = [],
    isLoading: componentsLoading,
    error: componentsError,
  } = useQuery({
    queryKey: ETF_COMPONENTS_KEY(productId, selectedDate ?? ''),
    queryFn: () => api.etfComponents.getByDate(productId, selectedDate!),
    enabled: productId > 0 && selectedDate !== null,
  })

  const error =
    (datesError instanceof Error ? datesError.message : null) ??
    (componentsError instanceof Error ? componentsError.message : null)

  return {
    dates: dates as readonly string[],
    selectedDate,
    setSelectedDate,
    components: components as readonly EtfComponent[],
    loading: datesLoading || componentsLoading,
    error,
    hasData: dates.length > 0,
  } as const
}
