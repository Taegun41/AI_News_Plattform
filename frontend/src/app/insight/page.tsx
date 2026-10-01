import React from 'react';
import Link from 'next/link';
import { Network } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import ReportDateNotice from '@/components/ReportDateNotice';
import { SECTORS, fetchDailyReport, fetchRawNewsSummaries, sectorToPath } from '@/lib/api';

/**
 * 트랙 1의 2단계 결과(분야 간 교차 분석)를 보여주는 페이지.
 * 예: '금리 인상'이 경제·사회·세계 분야에 동시에 영향을 주는 흐름 등.
 */
export default async function InsightPage() {
  const report = await fetchDailyReport();
  const correlations = report?.cross_correlations ?? [];

  // 모든 교차 테마의 참고 기사 제목을 한 번에 가져옵니다.
  const allUrls = Array.from(new Set(correlations.flatMap((c) => c.key_urls)));
  const articleMap = await fetchRawNewsSummaries(allUrls);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />

      <main className="max-w-[1000px] mx-auto px-6 py-12">
        <div className="mb-10 border-b-[3px] border-black pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-[#e63946] uppercase tracking-widest mb-2">Cross Analysis</p>
            <h2 className="text-4xl font-serif font-black">AI 인사이트</h2>
            <p className="text-gray-500 mt-2">서로 다른 분야의 이슈가 어떻게 연결되는지 AI가 분석했습니다.</p>
          </div>
          <ReportDateNotice reportDate={report?.report_date} />
        </div>

        {correlations.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            아직 분야 간 교차 분석 결과가 없습니다. 리포트는 매일 오전 6시에 만들어집니다.
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {correlations.map((item, idx) => (
              <section key={idx} className="bg-white border border-gray-200 shadow-sm p-8">
                <div className="flex items-start gap-3 mb-4">
                  <Network className="text-[#e63946] shrink-0 mt-1" size={22} />
                  <h3 className="text-2xl font-bold font-serif leading-snug">{item.correlation_theme}</h3>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  {item.related_sectors.map((sector) => {
                    const isKnown = (SECTORS as readonly string[]).includes(sector);
                    const badge = 'text-[11px] font-bold px-2 py-1 border border-[#e63946] text-[#e63946]';
                    return isKnown ? (
                      <Link key={sector} href={sectorToPath(sector)} className={`${badge} hover:bg-[#e63946] hover:text-white transition`}>
                        {sector}
                      </Link>
                    ) : (
                      <span key={sector} className={badge}>{sector}</span>
                    );
                  })}
                </div>

                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>

                {item.key_urls.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-gray-200">
                    <h4 className="text-sm font-bold mb-3 text-gray-800">근거 기사</h4>
                    <ul className="flex flex-col gap-2">
                      {item.key_urls.map((url) => {
                        const article = articleMap.get(url);
                        return (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                              {article ? (
                                <>
                                  <span className="text-[11px] font-bold text-[#e63946] mr-2">{article.theme_sector}</span>
                                  <span className="text-gray-800">{article.title}</span>
                                </>
                              ) : (
                                <span className="text-blue-600 break-all">{url}</span>
                              )}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
