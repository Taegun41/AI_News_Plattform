import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import { Bookmark, Share2, MessageSquare, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const articleId = resolvedParams.id;

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />
      <main className="max-w-[800px] mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/경제" className="text-sm font-bold text-gray-500 hover:text-black flex items-center transition">
            <ChevronLeft size={16} /> 경제 섹션으로 돌아가기
          </Link>
          <span className="text-xs font-bold text-[#e63946] uppercase tracking-widest border border-[#e63946] px-2 py-1">
            Global Economy
          </span>
        </div>
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-black font-serif leading-[1.3] mb-6">
            금리의 시대가 끝나고, 새로운 질서가 시작됐다
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-6 font-medium">
            세계 경제가 긴축의 터널을 지나 전환점에 섰다. 달라진 자본의 흐름과 산업 지형을 데이터로 읽는다.
          </p>
          <div className="flex justify-between items-center border-y border-gray-300 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 bg-[#e63946] rounded-full flex items-center justify-center font-bold text-white">AI</div>
              <div>
                <p className="font-bold">AI 인텔리전스 리포트</p>
                <p className="text-gray-500 text-xs">2026.10.01 10:30 • {articleId}번 기사</p>
              </div>
            </div>
            <div className="flex gap-4 text-gray-500">
              <button className="hover:text-black transition"><Share2 size={20} /></button>
              <button className="hover:text-black transition"><Bookmark size={20} /></button>
              <button className="hover:text-black transition"><MessageSquare size={20} /></button>
            </div>
          </div>
        </header>
        <figure className="mb-12">
          <div className="w-full aspect-[16/9] bg-gray-200 overflow-hidden mb-3">
            <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1200&auto=format&fit=crop" alt="Article Hero" className="w-full h-full object-cover" />
          </div>
          <figcaption className="text-xs text-gray-400 text-right">자료: AI News Platform 데이터센터</figcaption>
        </figure>
        <article className="prose prose-lg max-w-none prose-p:text-gray-800 prose-p:leading-[1.8] prose-p:mb-8 text-[17px]">
          <p>[깡통 본문] 글로벌 금융 시장이 중대한 변곡점을 맞이하고 있다...</p>
          <p>특히 주목해야 할 부분은 기술주와 인프라 관련 섹터의 움직임이다...</p>
          <div className="bg-gray-100 p-6 border-l-4 border-[#e63946] my-10 text-base">
            <strong>AI 분석 인사이트:</strong> "단기적인 시장 변동성에 일희일비하기보다는, 금리 하락기에 구조적으로 성장할 수 있는 테마에 주목해야 할 시점입니다."
          </div>
          <p>다만, 인플레이션 불씨가 완전히 꺼지지 않았다는 점은 변수다...</p>
        </article>
      </main>
    </div>
  );
}