// PRD-FEAT-012: ETF Component Collection Scheduler
import ExcelJS from 'exceljs'
import type { EtfProfile } from '../../shared/types.js'
import type { EtfComponentRow, EtfComponentAdapter } from './etf-component-adapter.js'

const COL_SYMBOL = '종목코드'
const COL_NAME = '종목명'
const COL_WEIGHT = '비중(%)'
const COL_SHARES = '보유수량'

export async function parseXlsBuffer(
  buffer: Buffer<ArrayBufferLike>,
  productId: number,
  snapshotDate: string,
): Promise<readonly EtfComponentRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount <= 1) return []

  const headerRow = sheet.getRow(1)
  const colMap = new Map<string, number>()
  headerRow.eachCell((cell, colNumber) => {
    const value = String(cell.value ?? '').trim()
    colMap.set(value, colNumber)
  })

  const symbolCol = colMap.get(COL_SYMBOL)
  const nameCol = colMap.get(COL_NAME)
  const weightCol = colMap.get(COL_WEIGHT)
  const sharesCol = colMap.get(COL_SHARES)

  if (!symbolCol || !nameCol) return []

  const results: EtfComponentRow[] = []

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const symbol = String(row.getCell(symbolCol).value ?? '').trim()
    const name = String(row.getCell(nameCol).value ?? '').trim()

    if (!symbol) continue

    const rawWeight = weightCol ? row.getCell(weightCol).value : null
    const rawShares = sharesCol ? row.getCell(sharesCol).value : null

    const weightNum = rawWeight != null ? Number(rawWeight) : NaN
    const sharesNum = rawShares != null ? Number(rawShares) : NaN

    const weight = !isNaN(weightNum) ? weightNum.toFixed(4) : null

    results.push({
      etf_product_id: productId,
      component_symbol: symbol,
      component_name: name,
      weight,
      shares: !isNaN(sharesNum) ? sharesNum : null,
      snapshot_date: snapshotDate,
    })
  }

  return results
}

export class SamsungActiveAdapter implements EtfComponentAdapter {
  constructor(
    private readonly fetchFn: (url: string) => Promise<Response> = globalThis.fetch,
  ) {}

  async fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]> {
    const response = await this.fetchFn(profile.download_url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText ?? 'Failed'}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return parseXlsBuffer(buffer, profile.product_id, snapshotDate)
  }
}
