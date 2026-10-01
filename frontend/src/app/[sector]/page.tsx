import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import BookmarkButton from '@/components/BookmarkButton';
import { Layers } from 'lucide-react';
import Link from 'next/link';
import { fetchDailyReport } from '@/lib/api';

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const resolvedParams = await params;
  const currentSector = decodeURIComponent(resolvedParams.sector).replace('-', '/');

  // 1. API를 통해 백엔드(DB)에서 오늘의 리포트 데이터를 가져옵니다.
  const report = await fetchDailyReport();
  
  // 2. 전체 분야 중 현재 페이지의 테마(예: 경제, 정치)와 일치하는 데이터만 찾습니다.
  const sectorData = report?.sectors.find(s => s.sector_name === currentSector);
  
  // 3. 해당 테마의 이슈 리스트를 추출합니다. 없으면 빈 배열 처리.
  const issues = sectorData?.issues || [];

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />
      
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-10 border-b-[3px] border-black pb-4">
          <h2 className="text-4xl font-serif font-black">{currentSector} 뉴스</h2>
          <p className="text-gray-500 mt-2">AI가 분석한 오늘의 {currentSector} 분야 핵심 이슈입니다.</p>
        </div>

        {/* 데이터가 없을 경우의 예외 처리 화면 */}
        {issues.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            오늘의 {currentSector} 분야 리포트가 아직 생성되지 않았거나 크롤링 중입니다.
          </div>
        ) : (
          <>
            {/* 1. 압도적 1위 이슈 (Hero Section) */}
            {issues[0] && (
              <Link href={`/article/1`} className="mb-16 group block cursor-pointer">
                <section>
                  <div className="w-full aspect-[21/9] bg-gray-300 mb-6 overflow-hidden relative">
                    <img 
                        src={issues[0].thumbnail_url || "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=1600&auto=format&fit=crop"} 
                        alt="hero" 
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                     />
                    <div className="absolute top-4 left-4 bg-[#e63946] text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1 shadow-md">
                      <Layers size={14} /> 관련 기사 {issues[0].article_count}건
                    </div>
                  </div>
                  <h3 className="text-4xl font-serif font-bold mb-4 group-hover:underline leading-tight">
                    {issues[0].issue_name}
                  </h3>
                  <p className="text-gray-600 text-lg mb-4 line-clamp-2 w-3/4">
                    {issues[0].summary}
                  </p>
                </section>
              </Link>
            )}

            {/* 2. 2~4위 이슈 (Grid Section) */}
            {issues.length > 1 && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 pb-16 border-b border-gray-300">
                {issues.slice(1, 4).map((issue, idx) => {
                  const rank = idx + 2;
                  return (
                    <Link href={`/article/${rank}`} key={rank} className="group block cursor-pointer">
                      <article>
                        <div className="w-full aspect-[4/3] bg-gray-200 mb-4 overflow-hidden relative">
                           <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 flex items-center gap-1 z-10">
                            <Layers size={12} /> {issue.article_count}건
                          </div>
                          <img 
                            src={issue.thumbnail_url || "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop"} 
                            alt="thumbnail" 
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
                  );
                })}
              </section>
            )}

            {/* 3. 5위 이하 리스트 (Row Section) */}
            {issues.length > 4 && (
              <section>
                <h3 className="text-lg font-bold font-serif mb-6 text-gray-800">기타 주요 {currentSector} 이슈</h3>
                <div className="flex flex-col gap-0 border-t border-black">
                  {issues.slice(4).map((issue, idx) => {
                    const rank = idx + 5;
                    return (
                      <Link href={`/article/${rank}`} key={rank} className="block group border-b border-gray-200 hover:bg-gray-50 transition px-2 cursor-pointer">
                        <article className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-5">
                          <div className="flex-1 pr-6">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-[#e63946] font-bold">랭킹 {rank}위</span>
                              <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-sm flex items-center gap-1">
                                 <Layers size={10} /> 기사 {issue.article_count}건
                              </span>
                            </div>
                            <h4 className="text-lg font-bold group-hover:underline text-gray-900 line-clamp-1">
                              {issue.issue_name}
                            </h4>
                          </div>
                          <div className="hidden sm:flex">
                            {/* 분리한 클라이언트 컴포넌트 사용 */}
                            <BookmarkButton size={18} />
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}