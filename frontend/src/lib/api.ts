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

export interface IssueCluster {
  issue_name: string;
  article_count: number;
  summary: string;
  main_article_url: string;
  related_urls: string[];
  thumbnail_url?: string; // 이 줄을 새롭게 추가합니다.
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * [트랙 1] 오늘의 정제된 전체 분야별 리포트를 가져옵니다.
 * 메인 페이지와 테마 페이지 렌더링에 사용됩니다.
 */
export async function fetchDailyReport(): Promise<DailyReport | null> {
  try {
    // Next.js 13+ App Router 캐싱 옵션 (일정 시간마다 갱신하거나 매번 새로고침)
    const response = await fetch(`${API_BASE_URL}/api/daily-report`, {
      cache: 'no-store', // 항상 최신 데이터를 가져옵니다.
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('오늘의 리포트가 아직 생성되지 않았습니다.');
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

/**
 * [트랙 2] 사용자의 키워드를 백엔드로 보내 AI 연관 분석 결과를 받아옵니다.
 * 검색 결과 페이지에서 실시간으로 사용됩니다.
 */
export async function searchTheme(keyword: string): Promise<Track2Report | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/search-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword }),
    });

    if (!response.ok) {
      throw new Error(`검색 중 오류가 발생했습니다. (상태 코드: ${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error('searchTheme API Error:', error);
    return null;
  }
}