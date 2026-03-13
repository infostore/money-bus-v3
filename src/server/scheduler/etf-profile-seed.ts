// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfManager } from '../../shared/types.js'
import type { EtfProfileSeedEntry } from '../database/etf-profile-repository.js'

export const VALID_MANAGERS: readonly EtfManager[] = ['samsung-active', 'timefolio', 'rise']

export const ETF_PROFILE_SEEDS: readonly EtfProfileSeedEntry[] = [
  // Samsung Active (KoAct): XLS download — gijunYMD= appended at runtime
  { productCode: '0015B0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFQ1&gijunYMD=', downloadType: 'xls' },
  { productCode: '0020H0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFQ5&gijunYMD=', downloadType: 'xls' },
  { productCode: '0051A0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFR2&gijunYMD=', downloadType: 'xls' },
  { productCode: '0074K0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFR6&gijunYMD=', downloadType: 'xls' },
  { productCode: '0093D0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFR9&gijunYMD=', downloadType: 'xls' },
  { productCode: '0104H0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFS3&gijunYMD=', downloadType: 'xls' },
  { productCode: '0113G0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFS9&gijunYMD=', downloadType: 'xls' },
  { productCode: '0132D0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFT2&gijunYMD=', downloadType: 'xls' },
  { productCode: '0150K0', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFT9&gijunYMD=', downloadType: 'xls' },
  { productCode: '462900', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFJ9&gijunYMD=', downloadType: 'xls' },
  { productCode: '471040', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFL3&gijunYMD=', downloadType: 'xls' },
  { productCode: '475070', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFL9&gijunYMD=', downloadType: 'xls' },
  { productCode: '476850', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFM2&gijunYMD=', downloadType: 'xls' },
  { productCode: '482030', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFM8&gijunYMD=', downloadType: 'xls' },
  { productCode: '487130', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFN8&gijunYMD=', downloadType: 'xls' },
  { productCode: '490330', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFO5&gijunYMD=', downloadType: 'xls' },
  { productCode: '495230', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFP3&gijunYMD=', downloadType: 'xls' },
  { productCode: '497780', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungactive.co.kr/excel_pdf.do?fId=2ETFO9&gijunYMD=', downloadType: 'xls' },

  // Samsung Fund (KODEX): same XLS format, uses samsung-active adapter
  { productCode: '445290', manager: 'samsung-active', expenseRatio: null, downloadUrl: 'https://www.samsungfund.com/fund/etf/pdf/down.do?fId=2ETFH5&gijunYMD=', downloadType: 'xls' },

  // TIMEFOLIO: HTML scrape — pdfDate= and mode=pdf appended at runtime
  { productCode: '0019K0', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=10&cate=001', downloadType: 'html' },
  { productCode: '0036D0', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=18&cate=001', downloadType: 'html' },
  { productCode: '0043Y0', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=19&cate=001', downloadType: 'html' },
  { productCode: '0113D0', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=22&cate=001', downloadType: 'html' },
  { productCode: '385710', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=17&cate=002', downloadType: 'html' },
  { productCode: '385720', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=11&cate=002', downloadType: 'html' },
  { productCode: '404120', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=16&cate=002', downloadType: 'html' },
  { productCode: '410870', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=1&cate=002', downloadType: 'html' },
  { productCode: '426020', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=5&cate=001', downloadType: 'html' },
  { productCode: '426030', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=2&cate=001', downloadType: 'html' },
  { productCode: '441800', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=12&cate=002', downloadType: 'html' },
  { productCode: '456600', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=6&cate=001', downloadType: 'html' },
  { productCode: '463050', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=13&cate=002', downloadType: 'html' },
  { productCode: '478150', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=20&cate=001', downloadType: 'html' },
  { productCode: '485810', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=9&cate=001', downloadType: 'html' },
  { productCode: '494180', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=8&cate=001', downloadType: 'html' },
  { productCode: '495060', manager: 'timefolio', expenseRatio: null, downloadUrl: 'https://timeetf.co.kr/m11_view.php?idx=15&cate=002', downloadType: 'html' },

  // RISE: HTML scrape — searchDate= appended at runtime
  { productCode: '0151P0', manager: 'rise', expenseRatio: null, downloadUrl: 'https://www.riseetf.co.kr/prod/finder/productViewTabExcel3?searchTargetId=44K0&searchDate=', downloadType: 'html' },
]
