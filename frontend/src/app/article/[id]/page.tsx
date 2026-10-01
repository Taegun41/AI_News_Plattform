import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import BookmarkButton from '@/components/BookmarkButton';
import ShareButton from '@/components/ShareButton';
import { ChevronLeft, ExternalLink, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  DEFAULT_THUMBNAIL,
  fetchDailyReport,
  fetchRawNews,
  fetchRawNewsSummaries,
  formatReportDate,
  getRankedIssues,
  sectorToPath,
} from '@/lib/api';

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const articleRank = parseInt(resolvedParams.id, 10);
  if (!Number.isInteger(articleRank) || articleRank < 1) notFound();

  // 1. 리포트를 가져와 전체 순위를 매깁니다. (메인·분야 페이지와 동일한 함수 사용)
  const report = await fetchDailyReport();
  if (!report) notFound();

  // 2. 현재 순위에 해당하는 AI 이슈 찾기
  const issue = getRankedIssues(report).find((item) => item.rank === articleRank);
  if (!issue) notFound();

  // 3. 대표 원본 기사(본문 포함)와 관련 기사들의 제목을 동시에 가져옵니다.
  const relatedUrls = Array.from(new Set(issue.related_urls)).filter((url) => url !== issue.main_article_url);
  const [rawNews, relatedMap] = await Promise.all([
    fetchRawNews(issue.main_article_url),
    fetchRawNewsSummaries(relatedUrls),
  ]);

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />

      <main className="max-w-[800px] mx-auto px-6 py-12">
        {/* 뒤로 가기 및 카테고리 */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href={sectorToPath(issue.sector_name)}
            className="text-sm font-bold text-gray-500 hover:text-black flex items-center gap-1 transition"
          >
            <ChevronLeft size={16} /> {issue.sector_name} 섹션으로 돌아가기
          </Link>
          <span className="text-xs font-bold text-[#e63946] uppercase tracking-widest border border-[#e63946] px-2 py-1">
            {issue.sector_name} Insight
          </span>
        </div>

        {/* 기사 헤더 (AI가 뽑은 타이틀과 요약) */}
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-black font-serif leading-[1.3] mb-6">
            {issue.issue_name}
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-6 font-medium">
            {issue.summary}
          </p>

          <div className="flex justify-between items-center border-y border-gray-300 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 bg-[#e63946] rounded-full flex items-center justify-center font-bold text-white">
                AI
              </div>
              <div>
                <p className="font-bold">AI News Platform 통합 분석</p>
                <p className="text-gray-500 text-xs">
                  {formatReportDate(report.report_date)} 리포트 • 전체 {articleRank}위 • 관련 기사 {issue.article_count}건
                </p>
              </div>
            </div>

            <div className="flex gap-4 text-gray-500 items-center">
              <ShareButton title={issue.issue_name} />
              <BookmarkButton
                size={20}
                item={{
                  url: issue.main_article_url,
                  title: issue.issue_name,
                  summary: issue.summary,
                  sector: issue.sector_name,
                  thumbnail_url: issue.thumbnail_url,
                }}
              />
            </div>
          </div>
        </header>

        {/* 기사 썸네일 */}
        <figure className="mb-12">
          <div className="w-full aspect-[16/9] bg-gray-200 overflow-hidden mb-3">
            <img
              src={issue.thumbnail_url || DEFAULT_THUMBNAIL}
              alt={issue.issue_name}
              className="w-full h-full object-cover"
            />
          </div>
          <figcaption className="text-xs text-gray-400 text-right">
            이미지 출처: 원본 기사 썸네일
          </figcaption>
        </figure>

        {/* 원본 기사 본문 및 요약 블록 */}
        <article className="max-w-none text-gray-800 text-[17px]">
          {/* AI 인사이트 블록 */}
          <div className="bg-gray-100 p-6 border-l-4 border-[#e63946] mb-10 text-base">
            <h3 className="font-bold text-[#e63946] mb-2 flex items-center gap-2">
              AI 핵심 요약
            </h3>
            <p className="m-0 leading-relaxed text-gray-700">
              이 이슈는 총 {issue.article_count}건의 기사에서 주요하게 다뤄지고 있습니다. {issue.summary}
            </p>
          </div>

          {/* 대표 원본 기사 */}
          {rawNews?.title && (
            <h2 className="text-2xl font-bold font-serif mb-2">{rawNews.title}</h2>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-6">
            {rawNews?.date && <span>{rawNews.date}</span>}
            <a
              href={issue.main_article_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline"
            >
              원문 보기 <ExternalLink size={12} />
            </a>
          </div>

          {/* 원본 기사 본문 (줄바꿈 반영) */}
          <div className="whitespace-pre-wrap leading-[1.9]">
            {rawNews?.body || '원본 기사 내용을 데이터베이스에서 불러올 수 없습니다. 위의 원문 보기 링크를 확인해주세요.'}
          </div>

          {/* 관련 기사 출처 영역 */}
          {relatedUrls.length > 0 && (
            <div className="mt-16 pt-8 border-t border-gray-300">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <LinkIcon size={18} /> 함께 분석된 관련 기사 ({relatedUrls.length}건)
              </h3>
              <ul className="flex flex-col divide-y divide-gray-200">
                {relatedUrls.map((url) => {
                  const related = relatedMap.get(url);
                  return (
                    <li key={url} className="py-3">
                      <a href={url} target="_blank" rel="noreferrer" className="group block">
                        {related ? (
                          <>
                            <div className="text-[11px] font-bold text-[#e63946] mb-1">
                              {related.theme_sector}
                            </div>
                            <p className="text-[15px] font-bold group-hover:underline leading-snug">
                              {related.title}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">{related.date}</p>
                          </>
                        ) : (
                          <span className="text-sm text-blue-600 group-hover:underline break-all">{url}</span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
