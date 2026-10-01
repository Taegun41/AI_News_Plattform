import React from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import BookmarkButton from '@/components/BookmarkButton';
import ReportDateNotice from '@/components/ReportDateNotice';
import { fetchDailyReport, getRankedIssues, sectorToPath } from '@/lib/api';

export default async function RankingPage() {
  const report = await fetchDailyReport();
  const issues = getRankedIssues(report);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />

      <main className="max-w-[900px] mx-auto px-6 py-12">
        <div className="mb-10 border-b-[3px] border-black pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h2 className="text-4xl font-serif font-black">전체 이슈 랭킹</h2>
            <p className="text-gray-500 mt-2">모든 분야의 이슈를 관련 기사 수 기준으로 정렬했습니다.</p>
          </div>
          <ReportDateNotice reportDate={report?.report_date} />
        </div>

        {issues.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            아직 생성된 리포트가 없습니다. 리포트는 매일 오전 6시에 만들어집니다.
          </div>
        ) : (
          <ol className="flex flex-col border-t border-black">
            {issues.map((issue) => (
              <li
                key={issue.rank}
                className="group border-b border-gray-200 hover:bg-gray-50 transition px-2 py-5 flex gap-5 items-start"
              >
                <div className="w-10 shrink-0 text-2xl font-serif font-bold italic text-[#e63946]/60">
                  {String(issue.rank).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={sectorToPath(issue.sector_name)}
                      className="text-xs text-[#e63946] font-bold hover:underline"
                    >
                      {issue.sector_name}
                    </Link>
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-sm flex items-center gap-1">
                      <Layers size={10} /> 기사 {issue.article_count}건
                    </span>
                  </div>
                  <Link href={`/article/${issue.rank}`} className="block">
                    <h3 className="text-lg font-bold group-hover:underline text-gray-900 line-clamp-1">
                      {issue.issue_name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-1 mt-1">{issue.summary}</p>
                  </Link>
                </div>
                <BookmarkButton
                  size={18}
                  className="mt-1"
                  item={{
                    url: issue.main_article_url,
                    title: issue.issue_name,
                    summary: issue.summary,
                    sector: issue.sector_name,
                    thumbnail_url: issue.thumbnail_url,
                  }}
                />
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
