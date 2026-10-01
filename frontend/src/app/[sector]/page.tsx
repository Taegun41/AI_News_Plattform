import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import BookmarkButton from '@/components/BookmarkButton';
import ReportDateNotice from '@/components/ReportDateNotice';
import { Layers } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DEFAULT_THUMBNAIL, SECTORS, fetchDailyReport, getRankedIssues, pathToSector } from '@/lib/api';

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const resolvedParams = await params;
  const currentSector = pathToSector(resolvedParams.sector);

  // 메뉴에 없는 주소(예: /아무거나)는 404 페이지로 보냅니다.
  if (!(SECTORS as readonly string[]).includes(currentSector)) {
    notFound();
  }

  // 1. 백엔드(DB)에서 리포트를 가져옵니다.
  const report = await fetchDailyReport();

  // 2. 전체 순위를 먼저 매긴 뒤 현재 분야만 골라냅니다.
  //    이렇게 해야 이 페이지의 링크(/article/순위)가 상세 페이지와 같은 이슈를 가리킵니다.
  const issues = getRankedIssues(report).filter((issue) => issue.sector_name === currentSector);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-10 border-b-[3px] border-black pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-4xl font-serif font-black">{currentSector} 뉴스</h2>
            <p className="text-gray-500 mt-2">AI가 분석한 {currentSector} 분야 핵심 이슈입니다.</p>
          </div>
          <ReportDateNotice reportDate={report?.report_date} />
        </div>

        {/* 데이터가 없을 경우의 예외 처리 화면 */}
        {issues.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            {currentSector} 분야 리포트가 아직 없습니다. 리포트는 매일 오전 6시에 만들어집니다.
          </div>
        ) : (
          <>
            {/* 1. 분야 내 1위 이슈 (Hero Section) */}
            <Link href={`/article/${issues[0].rank}`} className="mb-16 group block cursor-pointer">
              <section>
                <div className="w-full aspect-[21/9] bg-gray-300 mb-6 overflow-hidden relative">
                  <img
                    src={issues[0].thumbnail_url || DEFAULT_THUMBNAIL}
                    alt={issues[0].issue_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute top-4 left-4 bg-[#e63946] text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1 shadow-md">
                    <Layers size={14} /> 관련 기사 {issues[0].article_count}건
                  </div>
                </div>
                <h3 className="text-4xl font-serif font-bold mb-4 group-hover:underline leading-tight">
                  {issues[0].issue_name}
                </h3>
                <p className="text-gray-600 text-lg mb-4 line-clamp-2 md:w-3/4">
                  {issues[0].summary}
                </p>
              </section>
            </Link>

            {/* 2. 분야 내 2~4위 이슈 (Grid Section) */}
            {issues.length > 1 && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 pb-16 border-b border-gray-300">
                {issues.slice(1, 4).map((issue) => (
                  <Link href={`/article/${issue.rank}`} key={issue.rank} className="group block cursor-pointer">
                    <article>
                      <div className="w-full aspect-[4/3] bg-gray-200 mb-4 overflow-hidden relative">
                        <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 flex items-center gap-1 z-10">
                          <Layers size={12} /> {issue.article_count}건
                        </div>
                        <img
                          src={issue.thumbnail_url || DEFAULT_THUMBNAIL}
                          alt={issue.issue_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      </div>
                      <h4 className="text-xl font-bold mb-2 font-serif group-hover:underline leading-snug line-clamp-2">
                        {issue.issue_name}
                      </h4>
                      <p className="text-gray-500 text-sm line-clamp-2">
                        {issue.summary}
                      </p>
                    </article>
                  </Link>
                ))}
              </section>
            )}

            {/* 3. 분야 내 5위 이하 리스트 (Row Section) */}
            {issues.length > 4 && (
              <section>
                <h3 className="text-lg font-bold font-serif mb-6 text-gray-800">기타 주요 {currentSector} 이슈</h3>
                <div className="flex flex-col gap-0 border-t border-black">
                  {issues.slice(4).map((issue, idx) => (
                    <article
                      key={issue.rank}
                      className="group border-b border-gray-200 hover:bg-gray-50 transition px-2 flex flex-col sm:flex-row justify-between items-start sm:items-center py-5"
                    >
                      <Link href={`/article/${issue.rank}`} className="flex-1 pr-6 block">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-[#e63946] font-bold">
                            {currentSector} {idx + 5}위 · 전체 {issue.rank}위
                          </span>
                          <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-sm flex items-center gap-1">
                            <Layers size={10} /> 기사 {issue.article_count}건
                          </span>
                        </div>
                        <h4 className="text-lg font-bold group-hover:underline text-gray-900 line-clamp-1">
                          {issue.issue_name}
                        </h4>
                      </Link>
                      <div className="hidden sm:flex">
                        <BookmarkButton
                          size={18}
                          item={{
                            url: issue.main_article_url,
                            title: issue.issue_name,
                            summary: issue.summary,
                            sector: issue.sector_name,
                            thumbnail_url: issue.thumbnail_url,
                          }}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
