// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfProfile } from '../../shared/types.js'

export interface EtfComponentRow {
  readonly etf_product_id: number
  readonly component_symbol: string
  readonly component_name: string
  readonly weight: string | null
  readonly shares: number | null
  readonly snapshot_date: string
}

export interface EtfComponentAdapter {
  fetchComponents(
    profile: EtfProfile,
    snapshotDate: string,
  ): Promise<readonly EtfComponentRow[]>
}
