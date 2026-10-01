export interface IndexCard {
  code: string;
  name: string; // 코스피, 코스닥
  date: string;
  close: number;
  change: number;
  change_ratio: number;
  status: '장중' | '장마감';
  history: { date: string; close: number }[];
}

export interface StockItem {
  code: string;
  name: string;
  market: string; // KOSPI, KOSDAQ
  close: number;
  change: number;
  change_ratio: number;
  volume: number;
  amount: number; // 거래대금 (원)
  marcap: number; // 시가총액 (원)
}

export interface StockOverview {
  trade_date: string; // 기준 거래일 (YYYY-MM-DD)
  collected_at: string;
  is_today: boolean;
  is_latest: boolean; // 저장된 날짜 중 가장 최근인지
  is_legacy: boolean; // 예전 방식(수집 시각 기록 없음)으로 저장된 데이터인지
  available_dates: string[]; // 달력에서 고를 수 있는 거래일 (오래된 순)
  is_intraday: boolean; // 장중에 수집되어 확정되지 않은 데이터인지
  criteria: { surge_ratio: number; volume: number };
  indices: IndexCard[];
  upper_limit: StockItem[];
  lower_limit: StockItem[];
  surge: StockItem[];
  high_volume: StockItem[];
  total_stocks: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** date(YYYY-MM-DD)를 주면 그 거래일, 없으면 최신 거래일 데이터를 가져옵니다. */
export async function fetchStockOverview(date?: string): Promise<StockOverview | null> {
  try {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await fetch(`${API_BASE_URL}/api/stock/overview${query}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('fetchStockOverview API Error:', error);
    return null;
  }
}

/** 주식 데이터가 저장된 거래일 목록 */
export async function fetchStockDates(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stock/dates`, { cache: 'no-store' });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.dates) ? body.dates : [];
  } catch (error) {
    console.error('fetchStockDates API Error:', error);
    return [];
  }
}

// ----------------------------- 표시용 포맷 함수 -----------------------------

const JO = 1_0000_0000_0000; // 1조
const EOK = 1_0000_0000; // 1억
const MAN = 1_0000; // 1만

/** 상승은 빨강, 하락은 파랑 (국내 증시 관례) */
export function changeColor(value: number): string {
  if (value > 0) return 'text-[#e02f3a]';
  if (value < 0) return 'text-[#2f6fdf]';
  return 'text-gray-500';
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** +48,000(2.70%) 형식 */
export function formatChange(change: number, ratio: number, digits = 0): string {
  const sign = change > 0 ? '+' : change < 0 ? '-' : '';
  return `${sign}${formatNumber(Math.abs(change), digits)} (${Math.abs(ratio).toFixed(2)}%)`;
}

/** 거래량: 321만, 2,034만, 9,800 */
export function formatVolume(volume: number): string {
  if (volume >= MAN) return `${formatNumber(Math.round(volume / MAN))}만`;
  return formatNumber(volume);
}

/** 거래대금: 5조 7,819억 / 8,469억 / 3,200만 */
export function formatAmount(amount: number): string {
  if (amount >= JO) {
    const jo = Math.floor(amount / JO);
    const eok = Math.floor((amount % JO) / EOK);
    return eok > 0 ? `${formatNumber(jo)}조 ${formatNumber(eok)}억` : `${formatNumber(jo)}조`;
  }
  if (amount >= EOK) return `${formatNumber(Math.floor(amount / EOK))}억`;
  return `${formatNumber(Math.floor(amount / MAN))}만`;
}

/** 시가총액: 1,332조 / 25조 6천억 / 8,469억 */
export function formatMarcap(marcap: number): string {
  if (marcap >= 100 * JO) return `${formatNumber(Math.floor(marcap / JO))}조`;
  if (marcap >= JO) {
    const jo = Math.floor(marcap / JO);
    const cheonEok = Math.floor((marcap % JO) / (1000 * EOK));
    return cheonEok > 0 ? `${jo}조 ${cheonEok}천억` : `${jo}조`;
  }
  return `${formatNumber(Math.floor(marcap / EOK))}억`;
}

/** '2026-10-01' → '10. 1.' (캡처와 같은 짧은 날짜 표기) */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return m && d ? `${m}. ${d}.` : date;
}

/** '2026-10-01' → '10월 1일 (목)' */
export function formatTradeDate(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(d);
}
