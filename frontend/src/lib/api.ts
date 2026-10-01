export interface IssueCluster {
  issue_name: string;
  article_count: number;
  summary: string;
  main_article_url: string;
  related_urls: string[];
  thumbnail_url?: string;
}

export interface SectorReport {
  sector_name: string;
  issues: IssueCluster[];
}

export interface CrossCorrelation {
  correlation_theme: string;
  description: string;
  related_sectors: string[];
  key_urls: string[];
}

export interface DailyReport {
  id: number;
  report_date: string;
  sectors: SectorReport[];
  cross_correlations: CrossCorrelation[];
}

export interface Track2Report {
  search_keyword: string;
  theme_summary: string;
  detailed_viewpoints: string[];
  impact_analysis: string;
  key_urls: string[];
  meta_info?: string;
}

/** (현재 미사용) AI 요약 검색 응답 형식. 나중에 AI 요약을 다시 붙일 때 사용합니다. */
export interface Track2Response {
  ai_report: Track2Report;
  articles: RawNews[];
}

export interface RawNews {
  id: number;
  title: string;
  body: string;
  date: string;
  url: string;
  theme_sector: string;
  thumbnail_url: string;
}

/** 검색 결과의 기사 한 건 (본문 대신 검색어 주변 미리보기 포함) */
export interface SearchArticle {
  url: string;
  title: string;
  date: string;
  theme_sector: string;
  thumbnail_url?: string;
  snippet: string;
}

/** 최근 7일 관련 기사 검색 결과 */
export interface SearchResponse {
  keyword: string;
  terms: string[];
  match_type: 'all' | 'partial'; // all: 모든 단어 포함 / partial: 일부 단어만 포함
  total: number;
  articles: SearchArticle[];
}

/** 관련 기사 목록에 쓰는 가벼운 기사 정보 (본문 제외) */
export type RawNewsSummary = Pick<RawNews, 'url' | 'title' | 'date' | 'theme_sector' | 'thumbnail_url'>;

/** 전체 분야를 합쳐 기사 수 기준으로 매긴 순위가 붙은 이슈 */
export interface RankedIssue extends IssueCluster {
  sector_name: string;
  rank: number; // 1부터 시작하는 전체 순위. /article/[rank] 주소로 쓰입니다.
}

export const DEFAULT_THUMBNAIL =
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1200&auto=format&fit=crop';

/** 메뉴에 노출되는 뉴스 분야 (크롤러의 SECTION_MAP과 동일) */
export const SECTORS = ['정치', '경제', '사회', 'IT/과학', '세계'] as const;

/** 분야 이름을 URL 경로로 바꿉니다. 예: 'IT/과학' → '/IT-과학' */
export function sectorToPath(sectorName: string): string {
  return `/${sectorName.replace('/', '-')}`;
}

/** URL 경로 조각을 분야 이름으로 되돌립니다. 예: 'IT-과학' → 'IT/과학' */
export function pathToSector(slug: string): string {
  return decodeURIComponent(slug).replace('-', '/');
}

/**
 * 리포트의 모든 이슈를 하나로 합쳐 기사 수 순으로 정렬하고 전체 순위를 붙입니다.
 * 메인, 분야, 랭킹, 상세 페이지가 모두 이 함수 하나를 쓰기 때문에
 * 어느 페이지에서 눌러도 같은 번호는 항상 같은 이슈를 가리킵니다.
 */
export function getRankedIssues(report: DailyReport | null): RankedIssue[] {
  if (!report) return [];
  // Array.sort는 안정 정렬이라 기사 수가 같으면 원래 순서가 유지되어 순위가 항상 동일합니다.
  return report.sectors
    .flatMap((sector) =>
      sector.issues.map((issue) => ({ ...issue, sector_name: sector.sector_name }))
    )
    .sort((a, b) => b.article_count - a.article_count)
    .map((issue, idx) => ({ ...issue, rank: idx + 1 }));
}

/** 'YYYY-MM-DD' 형식의 오늘 날짜 (한국 시간 기준) */
export function todayInSeoul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/** 'YYYY-MM-DD' → 'M월 D일' */
export function formatReportDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  if (!m || !d) return dateStr;
  return `${m}월 ${d}일`;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * [트랙 1] 정제된 전체 분야별 리포트를 가져옵니다.
 * 오늘 리포트가 아직 없으면 백엔드가 가장 최근 리포트를 돌려줍니다.
 */
export async function fetchDailyReport(): Promise<DailyReport | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-report`, {
      cache: 'no-store', // 항상 최신 데이터를 가져옵니다.
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('생성된 리포트가 아직 없습니다.');
        return null;
      }
      throw new Error('리포트를 불러오는 중 오류가 발생했습니다.');
    }

    return await response.json();
  } catch (error) {
    console.error('fetchDailyReport API Error:', error);
    return null;
  }
}

/** 검색 결과: 성공이면 data, 실패면 상태 코드와 백엔드가 알려준 이유 */
export type SearchThemeResult =
  | { ok: true; data: SearchResponse }
  | { ok: false; status: number; message: string };

/**
 * 최근 7일 이내 기사 중 키워드와 관련된 기사를 전부 받아옵니다. (AI 요약 없음)
 * 실패하면 원인(기사 없음 404 / 서버 오류 500 / 서버 연결 실패 0)을 구분해서 돌려줍니다.
 */
export async function searchTheme(keyword: string): Promise<SearchThemeResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/search-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
      cache: 'no-store',
    });

    if (!response.ok) {
      let message = `검색 중 오류가 발생했습니다. (상태 코드: ${response.status})`;
      try {
        const body = await response.json();
        if (typeof body?.detail === 'string') message = body.detail;
      } catch {
        // 응답이 JSON이 아니면 기본 메시지를 사용합니다.
      }
      console.error(`searchTheme API Error (${response.status}):`, message);
      return { ok: false, status: response.status, message };
    }

    return { ok: true, data: await response.json() };
  } catch (error) {
    console.error('searchTheme API Error:', error);
    return {
      ok: false,
      status: 0,
      message: '백엔드 서버에 연결할 수 없습니다. API 서버(uvicorn)가 실행 중인지 확인해주세요.',
    };
  }
}

/**
 * 특정 URL의 원본 기사 데이터(본문 포함)를 가져옵니다.
 */
export async function fetchRawNews(url: string): Promise<RawNews | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/raw-news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('fetchRawNews API Error:', error);
    return null;
  }
}

/**
 * 여러 URL의 기사 제목·날짜를 한 번에 가져옵니다. (관련 기사 목록 표시용)
 * 결과는 url → 기사 정보 형태의 Map으로 돌려줍니다.
 */
export async function fetchRawNewsSummaries(urls: string[]): Promise<Map<string, RawNewsSummary>> {
  const result = new Map<string, RawNewsSummary>();
  if (urls.length === 0) return result;
  try {
    const response = await fetch(`${API_BASE_URL}/api/raw-news-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
      cache: 'no-store',
    });
    if (!response.ok) return result;
    const items: RawNewsSummary[] = await response.json();
    items.forEach((item) => result.set(item.url, item));
  } catch (error) {
    console.error('fetchRawNewsSummaries API Error:', error);
  }
  return result;
}
