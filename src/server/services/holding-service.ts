// PRD-FEAT-014: Holdings Management — computation logic
import { eq, and, asc } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { transactions, products, accounts, familyMembers, institutions } from '../database/schema.js'
import type * as schemaTypes from '../database/schema.js'
import type { PriceHistoryRepository } from '../database/price-history-repository.js'
import type { HoldingWithDetails, RealizedPnlEntry, Transaction } from '../../shared/types.js'

type Database = NodePgDatabase<typeof schemaTypes>

interface ComputedHolding {
  readonly accountId: number
  readonly productId: number
  readonly shares: number
  readonly avgCost: number
  readonly realizedPnlEntries: readonly RealizedPnlEntryInternal[]
}

interface RealizedPnlEntryInternal {
  readonly transactionId: number
  readonly tradedAt: string
  readonly productId: number
  readonly shares: number
  readonly sellPrice: number
  readonly avgCostAtSell: number
  readonly fee: number
  readonly tax: number
}

export interface HoldingsFilter {
  readonly account_id?: number
  readonly family_member_id?: number
}

export class HoldingService {
  constructor(
    private readonly db: Database,
    private readonly priceHistoryRepo: PriceHistoryRepository,
  ) {}

  async getHoldings(filter?: HoldingsFilter): Promise<readonly HoldingWithDetails[]> {
    const txns = await this.fetchTransactions(filter)
    if (txns.length === 0) return []

    const computed = computeHoldingsFromTransactions(txns)
    const activeHoldings = computed.filter((h) => h.shares > 0)
    if (activeHoldings.length === 0) return []

    return this.enrichHoldings(activeHoldings)
  }

  async getRealizedPnl(filter?: HoldingsFilter & {
    readonly from?: string
    readonly to?: string
  }): Promise<readonly RealizedPnlEntry[]> {
    const txns = await this.fetchTransactions(filter)
    if (txns.length === 0) return []

    const computed = computeHoldingsFromTransactions(txns)
    const productIds = [...new Set(computed.map((h) => h.productId))]
    const productMap = await this.fetchProductMap(productIds)

    const entries: RealizedPnlEntry[] = []
    for (const holding of computed) {
      for (const entry of holding.realizedPnlEntries) {
        if (filter?.from && entry.tradedAt < filter.from) continue
        if (filter?.to && entry.tradedAt > filter.to) continue

        const product = productMap.get(entry.productId)
        const grossPnl =
          entry.sellPrice * entry.shares - entry.avgCostAtSell * entry.shares
        const netPnl = grossPnl - entry.fee - entry.tax

        entries.push({
          transaction_id: entry.transactionId,
          traded_at: entry.tradedAt,
          product_id: entry.productId,
          product_name: product?.name ?? '',
          shares: entry.shares,
          sell_price: entry.sellPrice,
          avg_cost_at_sell: entry.avgCostAtSell,
          gross_pnl: grossPnl,
          fee: entry.fee,
          tax: entry.tax,
          net_pnl: netPnl,
        })
      }
    }

    return entries.sort((a, b) => b.traded_at.localeCompare(a.traded_at))
  }

  async validateSell(
    accountId: number,
    productId: number,
    sellShares: number,
    excludeTransactionId?: number,
  ): Promise<{ valid: boolean; heldShares: number }> {
    const txns = await this.fetchTransactionsByAccountProduct(accountId, productId)
    const filtered = excludeTransactionId
      ? txns.filter((t) => t.id !== excludeTransactionId)
      : txns

    let heldShares = 0
    for (const txn of filtered) {
      if (txn.type === 'buy') {
        heldShares += parseFloat(txn.shares)
      } else {
        heldShares -= parseFloat(txn.shares)
      }
    }

    return { valid: sellShares <= heldShares, heldShares }
  }

  async validateHistoryIntegrity(
    modifiedTxns: readonly Transaction[],
  ): Promise<{ valid: boolean; negativeDate?: string }> {
    let heldShares = 0

    for (const txn of modifiedTxns) {
      if (txn.type === 'buy') {
        heldShares += parseFloat(txn.shares)
      } else {
        heldShares -= parseFloat(txn.shares)
      }

      if (heldShares < -0.000001) {
        return { valid: false, negativeDate: txn.traded_at }
      }
    }

    return { valid: true }
  }

  private async fetchTransactions(
    filter?: HoldingsFilter,
  ): Promise<readonly TransactionRow[]> {
    const selectFields = {
      id: transactions.id,
      accountId: transactions.accountId,
      productId: transactions.productId,
      type: transactions.type,
      shares: transactions.shares,
      price: transactions.price,
      fee: transactions.fee,
      tax: transactions.tax,
      tradedAt: transactions.tradedAt,
    }

    const order = [asc(transactions.tradedAt), asc(transactions.id)] as const

    // When filtering by family member, join with accounts
    if (filter?.family_member_id !== undefined) {
      const where = filter.account_id !== undefined
        ? and(
            eq(transactions.accountId, filter.account_id),
            eq(accounts.familyMemberId, filter.family_member_id),
          )
        : eq(accounts.familyMemberId, filter.family_member_id)

      return this.db
        .select(selectFields)
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(where)
        .orderBy(...order)
    }

    // Simple filter by account_id only (or no filter)
    const where = filter?.account_id !== undefined
      ? eq(transactions.accountId, filter.account_id)
      : undefined

    return this.db
      .select(selectFields)
      .from(transactions)
      .where(where)
      .orderBy(...order)
  }

  private async fetchTransactionsByAccountProduct(
    accountId: number,
    productId: number,
  ): Promise<readonly TransactionRow[]> {
    return this.db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        productId: transactions.productId,
        type: transactions.type,
        shares: transactions.shares,
        price: transactions.price,
        fee: transactions.fee,
        tax: transactions.tax,
        tradedAt: transactions.tradedAt,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.productId, productId),
        ),
      )
      .orderBy(asc(transactions.tradedAt), asc(transactions.id))
  }

  private async enrichHoldings(
    holdings: readonly ComputedHolding[],
  ): Promise<readonly HoldingWithDetails[]> {
    const productIds = [...new Set(holdings.map((h) => h.productId))]
    const accountIds = [...new Set(holdings.map((h) => h.accountId))]

    const [productMap, accountMap, latestPrices, fxRates] = await Promise.all([
      this.fetchProductMap(productIds),
      this.fetchAccountMap(accountIds),
      this.priceHistoryRepo.findLatestByProductIds(productIds),
      this.fetchFxRates(productIds),
    ])

    let totalMarketValue = 0
    const holdingsWithValues = holdings.map((h) => {
      const product = productMap.get(h.productId)
      const latest = latestPrices.get(h.productId)
      const currentPrice = latest ? parseFloat(latest.close) : null
      const currency = product?.currency ?? 'KRW'
      const fxRate = currency === 'KRW' ? 1.0 : (fxRates.get(currency) ?? null)

      const costBasis = h.shares * h.avgCost
      let marketValue: number | null = null

      if (currentPrice !== null && fxRate !== null) {
        marketValue = h.shares * currentPrice * fxRate
        totalMarketValue += marketValue
      }

      return { holding: h, product, currentPrice, fxRate, costBasis, marketValue }
    })

    return holdingsWithValues.map(({ holding, product, currentPrice, fxRate, costBasis, marketValue }) => {
      const account = accountMap.get(holding.accountId)

      let unrealizedPnl: number | null = null
      let unrealizedPnlPercent: number | null = null
      if (marketValue !== null) {
        const costBasisInKrw = fxRate !== null ? costBasis * fxRate : costBasis
        unrealizedPnl = marketValue - costBasisInKrw
        unrealizedPnlPercent = costBasisInKrw > 0
          ? Math.round((unrealizedPnl / costBasisInKrw) * 10000) / 100
          : null
      }

      const weight = totalMarketValue > 0 && marketValue !== null
        ? Math.round((marketValue / totalMarketValue) * 10000) / 100
        : null

      return {
        account_id: holding.accountId,
        product_id: holding.productId,
        product_name: product?.name ?? '',
        asset_type: product?.assetType ?? '',
        currency: product?.currency ?? 'KRW',
        exchange: product?.exchange ?? null,
        shares: holding.shares,
        avg_cost: holding.avgCost,
        current_price: currentPrice,
        fx_rate: fxRate,
        market_value: marketValue,
        cost_basis: costBasis,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_percent: unrealizedPnlPercent,
        weight,
        account_name: account?.accountName ?? '',
        institution_name: account?.institutionName ?? '',
        family_member_name: account?.familyMemberName ?? '',
      }
    })
  }

  private async fetchProductMap(productIds: readonly number[]) {
    if (productIds.length === 0) return new Map()
    const rows = await this.db
      .select()
      .from(products)
      .where(
        productIds.length === 1
          ? eq(products.id, productIds[0])
          : undefined, // TODO: use inArray when drizzle import is available
      )
    // For multiple IDs, filter in memory (product count is small)
    const filtered = productIds.length === 1
      ? rows
      : rows.filter((r) => productIds.includes(r.id))
    return new Map(filtered.map((r) => [r.id, r]))
  }

  private async fetchAccountMap(accountIds: readonly number[]) {
    if (accountIds.length === 0) return new Map()
    const rows = await this.db
      .select({
        id: accounts.id,
        accountName: accounts.accountName,
        familyMemberName: familyMembers.name,
        institutionName: institutions.name,
      })
      .from(accounts)
      .innerJoin(familyMembers, eq(accounts.familyMemberId, familyMembers.id))
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
    const filtered = rows.filter((r) => accountIds.includes(r.id))
    return new Map(filtered.map((r) => [r.id, r]))
  }

  private async fetchFxRates(
    productIds: readonly number[],
  ): Promise<ReadonlyMap<string, number>> {
    const productMap = await this.fetchProductMap(productIds)
    const currencies = new Set<string>()
    for (const [, product] of productMap) {
      if (product.currency !== 'KRW') {
        currencies.add(product.currency)
      }
    }

    if (currencies.size === 0) return new Map()

    // Look up FX products by code convention: FX:{currency}KRW
    const fxCodes = [...currencies].map((c) => `FX:${c}KRW`)
    const fxProducts = await this.db
      .select({ id: products.id, code: products.code, currency: products.currency })
      .from(products)

    const fxProductMap = new Map<string, number>()
    for (const fp of fxProducts) {
      if (fp.code && fxCodes.includes(fp.code)) {
        fxProductMap.set(fp.code, fp.id)
      }
    }

    const fxProductIds = [...fxProductMap.values()]
    if (fxProductIds.length === 0) return new Map()

    const latestFx = await this.priceHistoryRepo.findLatestByProductIds(fxProductIds)
    const result = new Map<string, number>()
    for (const currency of currencies) {
      const fxCode = `FX:${currency}KRW`
      const fxProdId = fxProductMap.get(fxCode)
      if (fxProdId !== undefined) {
        const price = latestFx.get(fxProdId)
        if (price) {
          result.set(currency, parseFloat(price.close))
        }
      }
    }
    return result
  }
}

interface TransactionRow {
  readonly id: number
  readonly accountId: number
  readonly productId: number
  readonly type: string
  readonly shares: string
  readonly price: string
  readonly fee: string
  readonly tax: string
  readonly tradedAt: string
}

export function computeHoldingsFromTransactions(
  txns: readonly TransactionRow[],
): readonly ComputedHolding[] {
  // Group by (accountId, productId)
  const groups = new Map<string, TransactionRow[]>()
  for (const txn of txns) {
    const key = `${txn.accountId}:${txn.productId}`
    const group = groups.get(key)
    if (group) {
      group.push(txn)
    } else {
      groups.set(key, [txn])
    }
  }

  const results: ComputedHolding[] = []
  for (const [, groupTxns] of groups) {
    // Sort by traded_at, then id
    const sorted = [...groupTxns].sort(
      (a, b) => a.tradedAt.localeCompare(b.tradedAt) || a.id - b.id,
    )

    let heldShares = 0
    let avgCost = 0
    const realizedEntries: RealizedPnlEntryInternal[] = []

    for (const txn of sorted) {
      const shares = parseFloat(txn.shares)
      const price = parseFloat(txn.price)
      const fee = parseFloat(txn.fee)
      const tax = parseFloat(txn.tax)

      if (txn.type === 'buy') {
        const totalCost = heldShares * avgCost + (shares * price + fee + tax)
        heldShares += shares
        avgCost = heldShares > 0 ? totalCost / heldShares : 0
      } else {
        // sell
        realizedEntries.push({
          transactionId: txn.id,
          tradedAt: txn.tradedAt,
          productId: sorted[0].productId,
          shares,
          sellPrice: price,
          avgCostAtSell: avgCost,
          fee,
          tax,
        })
        heldShares -= shares
        if (heldShares < 0.000001) {
          heldShares = 0
          avgCost = 0
        }
      }
    }

    results.push({
      accountId: sorted[0].accountId,
      productId: sorted[0].productId,
      shares: heldShares,
      avgCost,
      realizedPnlEntries: realizedEntries,
    })
  }

  return results
}
