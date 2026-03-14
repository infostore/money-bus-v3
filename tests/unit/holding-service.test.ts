// PRD-FEAT-014: HoldingService computation tests
import { describe, it, expect } from 'vitest'
import { computeHoldingsFromTransactions } from '../../src/server/services/holding-service.js'

function makeTxn(overrides: {
  id: number
  accountId?: number
  productId?: number
  type: string
  shares: string
  price: string
  fee?: string
  tax?: string
  tradedAt: string
}) {
  return {
    id: overrides.id,
    accountId: overrides.accountId ?? 1,
    productId: overrides.productId ?? 1,
    type: overrides.type,
    shares: overrides.shares,
    price: overrides.price,
    fee: overrides.fee ?? '0',
    tax: overrides.tax ?? '0',
    tradedAt: overrides.tradedAt,
  }
}

describe('computeHoldingsFromTransactions', () => {
  it('computes avg_cost for a single buy', () => {
    const txns = [
      makeTxn({ id: 1, type: 'buy', shares: '10', price: '100', fee: '50', tradedAt: '2026-01-01' }),
    ]

    const [holding] = computeHoldingsFromTransactions(txns)

    expect(holding.shares).toBe(10)
    // cost = 10*100 + 50 = 1050, avg_cost = 1050/10 = 105.0
    expect(holding.avgCost).toBeCloseTo(105.0)
  })

  it('computes canonical test fixture from PRD', () => {
    // Buy 10@100 (fee=50) → avg_cost=105.0
    // Buy 10@110 (fee=50) → avg_cost=110.0
    // Sell 5@120 (fee=10, tax=20) → realized_pnl=20.0
    const txns = [
      makeTxn({ id: 1, type: 'buy', shares: '10', price: '100', fee: '50', tradedAt: '2026-01-01' }),
      makeTxn({ id: 2, type: 'buy', shares: '10', price: '110', fee: '50', tradedAt: '2026-01-02' }),
      makeTxn({ id: 3, type: 'sell', shares: '5', price: '120', fee: '10', tax: '20', tradedAt: '2026-01-03' }),
    ]

    const [holding] = computeHoldingsFromTransactions(txns)

    // After 2 buys: total_cost = (10*100+50) + (10*110+50) = 1050+1150 = 2200
    // held_shares = 20, avg_cost = 2200/20 = 110.0
    expect(holding.avgCost).toBeCloseTo(110.0)

    // After sell 5: held_shares = 15, avg_cost unchanged = 110.0
    expect(holding.shares).toBe(15)

    // Realized P&L: (120*5 - 10 - 20) - (110*5) = 570 - 550 = 20.0
    expect(holding.realizedPnlEntries).toHaveLength(1)
    const entry = holding.realizedPnlEntries[0]
    const grossPnl = entry.sellPrice * entry.shares - entry.avgCostAtSell * entry.shares
    const netPnl = grossPnl - entry.fee - entry.tax
    expect(netPnl).toBeCloseTo(20.0)
  })

  it('handles sell to zero then rebuy (avg_cost resets)', () => {
    const txns = [
      makeTxn({ id: 1, type: 'buy', shares: '10', price: '100', tradedAt: '2026-01-01' }),
      makeTxn({ id: 2, type: 'sell', shares: '10', price: '120', tradedAt: '2026-01-02' }),
      makeTxn({ id: 3, type: 'buy', shares: '5', price: '200', tradedAt: '2026-01-03' }),
    ]

    const [holding] = computeHoldingsFromTransactions(txns)

    expect(holding.shares).toBe(5)
    // After sell to zero, avg_cost resets. New buy: avg_cost = 200
    expect(holding.avgCost).toBeCloseTo(200.0)
  })

  it('accumulates realized P&L across multiple sells', () => {
    const txns = [
      makeTxn({ id: 1, type: 'buy', shares: '20', price: '100', tradedAt: '2026-01-01' }),
      makeTxn({ id: 2, type: 'sell', shares: '5', price: '110', tradedAt: '2026-01-02' }),
      makeTxn({ id: 3, type: 'sell', shares: '5', price: '120', tradedAt: '2026-01-03' }),
    ]

    const [holding] = computeHoldingsFromTransactions(txns)

    expect(holding.shares).toBe(10)
    expect(holding.realizedPnlEntries).toHaveLength(2)

    // First sell: (110-100)*5 = 50
    const e1 = holding.realizedPnlEntries[0]
    expect(e1.sellPrice * e1.shares - e1.avgCostAtSell * e1.shares).toBeCloseTo(50)

    // Second sell: (120-100)*5 = 100
    const e2 = holding.realizedPnlEntries[1]
    expect(e2.sellPrice * e2.shares - e2.avgCostAtSell * e2.shares).toBeCloseTo(100)
  })

  it('groups by (accountId, productId)', () => {
    const txns = [
      makeTxn({ id: 1, accountId: 1, productId: 1, type: 'buy', shares: '10', price: '100', tradedAt: '2026-01-01' }),
      makeTxn({ id: 2, accountId: 1, productId: 2, type: 'buy', shares: '5', price: '200', tradedAt: '2026-01-01' }),
      makeTxn({ id: 3, accountId: 2, productId: 1, type: 'buy', shares: '3', price: '150', tradedAt: '2026-01-01' }),
    ]

    const holdings = computeHoldingsFromTransactions(txns)

    expect(holdings).toHaveLength(3)
    const h1 = holdings.find((h) => h.accountId === 1 && h.productId === 1)
    const h2 = holdings.find((h) => h.accountId === 1 && h.productId === 2)
    const h3 = holdings.find((h) => h.accountId === 2 && h.productId === 1)

    expect(h1?.shares).toBe(10)
    expect(h2?.shares).toBe(5)
    expect(h3?.shares).toBe(3)
  })

  it('returns empty array for no transactions', () => {
    const holdings = computeHoldingsFromTransactions([])
    expect(holdings).toHaveLength(0)
  })

  it('includes buy-side fees in cost basis', () => {
    const txns = [
      makeTxn({ id: 1, type: 'buy', shares: '10', price: '100', fee: '100', tax: '50', tradedAt: '2026-01-01' }),
    ]

    const [holding] = computeHoldingsFromTransactions(txns)

    // cost = 10*100 + 100 + 50 = 1150, avg_cost = 115.0
    expect(holding.avgCost).toBeCloseTo(115.0)
  })

  it('deducts sell-side fees from realized P&L', () => {
    const txns = [
      makeTxn({ id: 1, type: 'buy', shares: '10', price: '100', tradedAt: '2026-01-01' }),
      makeTxn({ id: 2, type: 'sell', shares: '10', price: '100', fee: '30', tax: '20', tradedAt: '2026-01-02' }),
    ]

    const [holding] = computeHoldingsFromTransactions(txns)
    const entry = holding.realizedPnlEntries[0]

    // gross = (100-100)*10 = 0
    // net = 0 - 30 - 20 = -50
    const grossPnl = entry.sellPrice * entry.shares - entry.avgCostAtSell * entry.shares
    expect(grossPnl).toBeCloseTo(0)
    expect(grossPnl - entry.fee - entry.tax).toBeCloseTo(-50)
  })

  it('orders same-day transactions by id', () => {
    const txns = [
      makeTxn({ id: 2, type: 'buy', shares: '10', price: '200', tradedAt: '2026-01-01' }),
      makeTxn({ id: 1, type: 'buy', shares: '10', price: '100', tradedAt: '2026-01-01' }),
    ]

    const [holding] = computeHoldingsFromTransactions(txns)

    // Sorted by id: first buy 10@100, then buy 10@200
    // avg_cost = (10*100 + 10*200) / 20 = 3000/20 = 150
    expect(holding.avgCost).toBeCloseTo(150.0)
  })
})
