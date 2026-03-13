import { describe, it, expect } from 'vitest'
import type { PriceHistory } from '@shared/types'
import {
  getLatestClose,
  get52WeekHigh,
  get52WeekLow,
  getDateRange,
  rangeToFromDate,
} from '../price-history-utils'

/** Helper to create a minimal PriceHistory row */
function makeRow(date: string, close: string): PriceHistory {
  return {
    id: 1,
    product_id: 1,
    date,
    open: null,
    high: null,
    low: null,
    close,
    volume: null,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('price-history-utils', () => {
  describe('getLatestClose', () => {
    it('returns null for empty array', () => {
      expect(getLatestClose([])).toBeNull()
    })

    it('returns close of most recent date', () => {
      const rows = [
        makeRow('2025-01-01', '100.00'),
        makeRow('2025-03-01', '120.00'),
        makeRow('2025-02-01', '110.00'),
      ]
      expect(getLatestClose(rows)).toBe('120.00')
    })

    it('handles single row', () => {
      expect(getLatestClose([makeRow('2025-01-01', '50.00')])).toBe('50.00')
    })
  })

  describe('get52WeekHigh', () => {
    it('returns null for empty array', () => {
      expect(get52WeekHigh([])).toBeNull()
    })

    it('returns highest close price', () => {
      const rows = [
        makeRow('2025-01-01', '100.00'),
        makeRow('2025-02-01', '150.50'),
        makeRow('2025-03-01', '120.00'),
      ]
      expect(get52WeekHigh(rows)).toBe('150.50')
    })

    it('handles single row', () => {
      expect(get52WeekHigh([makeRow('2025-01-01', '42.00')])).toBe('42.00')
    })

    it('handles decimal precision', () => {
      const rows = [
        makeRow('2025-01-01', '100.1234'),
        makeRow('2025-02-01', '100.1235'),
      ]
      expect(get52WeekHigh(rows)).toBe('100.1235')
    })
  })

  describe('get52WeekLow', () => {
    it('returns null for empty array', () => {
      expect(get52WeekLow([])).toBeNull()
    })

    it('returns lowest close price', () => {
      const rows = [
        makeRow('2025-01-01', '100.00'),
        makeRow('2025-02-01', '50.25'),
        makeRow('2025-03-01', '120.00'),
      ]
      expect(get52WeekLow(rows)).toBe('50.25')
    })
  })

  describe('getDateRange', () => {
    it('returns null for empty array', () => {
      expect(getDateRange([])).toBeNull()
    })

    it('returns from and to dates', () => {
      const rows = [
        makeRow('2025-03-01', '120.00'),
        makeRow('2025-01-01', '100.00'),
        makeRow('2025-02-01', '110.00'),
      ]
      expect(getDateRange(rows)).toEqual({
        from: '2025-01-01',
        to: '2025-03-01',
      })
    })

    it('handles single row', () => {
      const rows = [makeRow('2025-06-15', '100.00')]
      expect(getDateRange(rows)).toEqual({
        from: '2025-06-15',
        to: '2025-06-15',
      })
    })
  })

  describe('rangeToFromDate', () => {
    const refDate = new Date('2026-03-13T00:00:00Z')

    it('returns undefined for ALL', () => {
      expect(rangeToFromDate('ALL', refDate)).toBeUndefined()
    })

    it('returns 1 month ago for 1M', () => {
      expect(rangeToFromDate('1M', refDate)).toBe('2026-02-13')
    })

    it('returns 3 months ago for 3M', () => {
      expect(rangeToFromDate('3M', refDate)).toBe('2025-12-13')
    })

    it('returns 6 months ago for 6M', () => {
      expect(rangeToFromDate('6M', refDate)).toBe('2025-09-13')
    })

    it('returns 1 year ago for 1Y', () => {
      expect(rangeToFromDate('1Y', refDate)).toBe('2025-03-13')
    })
  })
})
