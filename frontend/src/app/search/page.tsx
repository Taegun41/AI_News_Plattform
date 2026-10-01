import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import { DEFAULT_THUMBNAIL, searchTheme } from '@/lib/api';

/** 텍스트 안의 검색어를 <mark>로 강조합니다. (대소문자 무시) */
function highlight(text: string, terms: string[]): React.ReactNode {
  const validTerms = terms.filter(Boolean);
  if (!text || validTerms.length === 0) return text;

  const escaped = validTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const lowerTerms = validTerms.map((t) => t.toLowerCase());

  return text.split(regex).map((part, idx) =>
    lowerTerms.includes(part.toLowerCase()) ? (
      <mark key={idx} className="bg-[#e63946]/15 text-inherit px-0.5">
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

/** '2026-10-01 14:23:00' → '10월 1일 14:23' */
function formatArticleDate(date: string): string {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return date;
  const [, , m, d, hh, mm] = match;
  return `${Number(m)}월 ${Number(d)}일${hh ? ` ${hh}:${mm}` : ''}`;
}

export default async function SearchResultPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sector?: string }>;
}) {
  // URL 파라미터(예: /search?q=원전&sector=경제)를 읽어옵니다.
  const resolvedParams = await searchParams;
  const keyword = resolvedParams.q?.trim();
  const selectedSector = resolvedParams.sector;

  // 검색어가 없으면 안내 문구 표시
  if (!keyword) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a]">
        <SiteHeader />
        <StickyNav />
        <main className="max-w-[1200px] mx-auto px-6 py-20 text-center text-gray-500 font-sans">
          상단의 검색 아이콘을 눌러 관심 있는 키워드를 입력해주세요.
        </main>
      </div>
    );
  }

  const searchResult = await searchTheme(keyword);
  const result = searchResult.ok ? searchResult.data : null;

  // 분야별 기사 수 (필터 버튼에 표시)
  const sectorCounts = new Map<string, number>();
  result?.articles.forEach((article) => {
    const sector = article.theme_sector || '기타';
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  });

  const visibleArticles =
    result?.articles.filter((article) => !selectedSector || (article.theme_sector || '기타') === selectedSector) ?? [];

  const searchHref = (sector?: string) =>
    `/search?q=${encodeURIComponent(keyword)}${sector ? `&sector=${encodeURIComponent(sector)}` : ''}`;

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />
      <main className="max-w-[900px] mx-auto px-6 py-12">
        <div className="mb-8 border-b-2 border-black pb-6">
          <p className="text-sm font-bold text-[#e63946] tracking-widest mb-3 uppercase">Search</p>
          <h2 className="text-3xl font-bold font-serif mb-3 leading-tight">
            &ldquo;{keyword}&rdquo; 관련 최근 7일 기사
          </h2>
          {result && (
            <p className="text-gray-500 text-sm">
              총 {result.total}건 · 최신순
              {result.match_type === 'partial' && (
                <span className="block mt-1 text-amber-700">
                  모든 단어가 들어간 기사가 없어, 일부 단어만 포함된 기사를 보여드립니다.
                </span>
              )}
            </p>
          )}
        </div>

        {!searchResult.ok ? (
          searchResult.status === 404 ? (
            <div className="py-20 text-center text-gray-500">
              <p>&lsquo;{keyword}&rsquo; 관련 최근 7일 기사를 찾을 수 없습니다.</p>
              <p className="text-sm mt-2">다른 단어로 검색하거나 단어 수를 줄여보세요.</p>
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-gray-700 font-bold">
                {searchResult.status === 0 ? '서버에 연결하지 못했습니다.' : '검색 중 문제가 발생했습니다.'}
              </p>
              <p className="text-sm text-gray-500 mt-2 break-all">{searchResult.message}</p>
            </div>
          )
        ) : result ? (
          <>
            {/* 분야 필터 */}
            {sectorCounts.size > 1 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <Link
                  href={searchHref()}
                  className={`text-xs font-bold px-3 py-1.5 border transition ${
                    !selectedSector
                      ? 'bg-black text-white border-black'
                      : 'border-gray-300 text-gray-600 hover:border-black'
                  }`}
                >
                  전체 {result.total}
                </Link>
                {Array.from(sectorCounts.entries()).map(([sector, count]) => (
                  <Link
                    key={sector}
                    href={searchHref(sector)}
                    className={`text-xs font-bold px-3 py-1.5 border transition ${
                      selectedSector === sector
                        ? 'bg-[#e63946] text-white border-[#e63946]'
                        : 'border-gray-300 text-gray-600 hover:border-black'
                    }`}
                  >
                    {sector} {count}
                  </Link>
                ))}
              </div>
            )}

            {/* 기사 목록 */}
            <ul className="flex flex-col border-t border-black">
              {visibleArticles.map((article) => (
                <li key={article.url} className="border-b border-gray-200">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex gap-5 py-6 hover:bg-white/60 transition px-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] mb-2">
                        <span className="font-bold text-[#e63946]">{article.theme_sector || '기타'}</span>
                        <span className="text-gray-400">{formatArticleDate(article.date)}</span>
                      </div>
                      <h3 className="text-lg font-bold leading-snug mb-2 group-hover:underline">
                        {highlight(article.title, result.terms)}
                        <ExternalLink size={13} className="inline ml-1 text-gray-400 align-baseline" />
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                        {highlight(article.snippet, result.terms)}
                      </p>
                    </div>
                    <div className="hidden sm:block w-32 aspect-[4/3] bg-gray-200 overflow-hidden shrink-0">
                      <img
                        src={article.thumbnail_url || DEFAULT_THUMBNAIL}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
    </div>
  );
}
