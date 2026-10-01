import React from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';
import BookmarkButton from '@/components/BookmarkButton';
import ReportDateNotice from '@/components/ReportDateNotice';
import { DailyReport, DEFAULT_THUMBNAIL, getRankedIssues } from '@/lib/api';

export default function CoreNews({ report }: { report: DailyReport | null }) {
  // 전체 순위 (메인·분야·상세 페이지가 모두 같은 순위를 사용합니다)
  const allIssues = getRankedIssues(report);

  // 1~2위 이슈는 좌측 메인 영역에, 3~7위 이슈는 우측 트렌딩 리스트에 할당합니다.
  const topIssues = allIssues.slice(0, 2);
  const trendingIssues = allIssues.slice(2, 7);

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="border-t-[3px] border-black pt-4 mb-8 flex justify-between items-center gap-4">
        <h2 className="text-xs font-bold text-[#e63946] uppercase tracking-widest">
          Today&apos;s Edition
        </h2>
        <ReportDateNotice reportDate={report?.report_date} />
      </div>

      {allIssues.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          아직 생성된 리포트가 없습니다. 리포트는 매일 오전 6시에 만들어집니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* 좌측 메인 영역 (가장 큰 이슈 2개) */}
          <div className="lg:col-span-8 flex flex-col gap-16">
            {topIssues.map((issue) => (
              <article key={issue.rank} className="group">
                <Link href={`/article/${issue.rank}`} className="block">
                  <div className="w-full aspect-[16/9] bg-gray-300 mb-5 overflow-hidden">
                    <img
                      src={issue.thumbnail_url || DEFAULT_THUMBNAIL}
                      alt={issue.issue_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                  </div>
                  <div className="text-xs font-bold text-[#e63946] mb-3 uppercase tracking-wider">
                    {issue.sector_name}
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight font-serif group-hover:underline line-clamp-2">
                    {issue.issue_name}
                  </h3>
                  <p className="text-gray-600 text-base mb-5 line-clamp-2 leading-relaxed">
                    {issue.summary}
                  </p>
                </Link>
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>관련 기사 {issue.article_count}건 • AI 분석 리포트</span>
                  <BookmarkButton
                    size={16}
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

          {/* 우측 트렌딩 리스트 (3위~7위 이슈) */}
          <div className="lg:col-span-4 lg:border-l lg:border-gray-300 lg:pl-10">
            <div className="flex justify-between items-center border-b border-black pb-4 mb-6">
              <h3 className="text-xl font-bold font-serif">지금 많이 다뤄지는 이슈</h3>
              <TrendingUp className="text-[#e63946]" size={20} />
            </div>

            <div className="flex flex-col gap-7">
              {trendingIssues.map((issue) => (
                <Link
                  href={`/article/${issue.rank}`}
                  key={issue.rank}
                  className="group cursor-pointer block border-b border-gray-200 pb-7 last:border-0"
                >
                  <article className="flex gap-5">
                    <div className="text-3xl font-serif text-[#e63946]/40 font-bold italic">
                      {String(issue.rank).padStart(2, '0')}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-[#e63946] mb-1">{issue.sector_name}</div>
                      <h4 className="text-[15px] font-bold leading-snug mb-2 group-hover:underline line-clamp-2">
                        {issue.issue_name}
                      </h4>
                      <div className="text-[11px] text-gray-400">관련 기사 {issue.article_count}건</div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            <Link
              href="/ranking"
              className="w-full mt-4 py-4 text-xs font-bold flex justify-between items-center hover:text-[#e63946] transition border-t border-gray-200"
            >
              전체 랭킹 보기 <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
