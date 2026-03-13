// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfManager } from '../../shared/types.js'
import type { EtfProfileSeedEntry } from '../database/etf-profile-repository.js'

export const VALID_MANAGERS: readonly EtfManager[] = ['samsung-active', 'timefolio', 'rise']

// Placeholder URLs — populate with real URLs in Wave 8 before enabling cron
export const ETF_PROFILE_SEEDS: readonly EtfProfileSeedEntry[] = [
  // Samsung Active: XLS download
  // { productCode: 'KODEX200', manager: 'samsung-active', expenseRatio: '0.0015', downloadUrl: 'https://...', downloadType: 'xls' },

  // TIMEFOLIO: HTML scrape
  // { productCode: 'TIMEFOLIO...', manager: 'timefolio', expenseRatio: '0.0050', downloadUrl: 'https://...', downloadType: 'html' },

  // RISE: HTML scrape
  // { productCode: 'RISE...', manager: 'rise', expenseRatio: '0.0030', downloadUrl: 'https://...', downloadType: 'html' },
]
