import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';

export default function SearchResultPage() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-10 border-b-2 border-black pb-6">
          <p className="text-sm font-bold text-[#e63946] tracking-widest mb-3 uppercase">AI Search Insight</p>
          <h2 className="text-3xl font-bold font-serif mb-3 leading-tight">"일주일 내 보성파워텍과 연관된 기사 찾아줘"</h2>
          <p className="text-gray-500 text-sm">데이터베이스 탐색 및 중복 제거 완료 • 핵심 기사 5건 요약</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <section className="lg:col-span-8 flex flex-col gap-8">
            <div className="bg-white p-8 border border-gray-200 shadow-sm">
              <h3 className="text-xl font-bold border-b border-gray-200 pb-4 mb-4">테마 핵심 요약</h3>
              <p className="text-gray-700 leading-relaxed mb-6">[깡통 데이터] 최근 원전 생태계 복원 및 SMR 투자 확대 소식...</p>
              <h3 className="text-lg font-bold mb-3">주요 관점 및 팩트</h3>
              <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2 mb-6">
                <li>[깡통] 정부의 제11차 전력수급기본계획 실무안 발표 영향</li>
                <li>[깡통] AI 데이터센터 확충에 따른 구조적인 전력 기기 수요 증가</li>
              </ul>
              <h3 className="text-lg font-bold mb-3">시장 및 산업 영향</h3>
              <p className="text-gray-700 leading-relaxed">[깡통] 중장기적으로 송배전망 인프라 투자가 지속될 전망...</p>
            </div>
          </section>
          <section className="lg:col-span-4 lg:border-l lg:border-gray-300 lg:pl-10">
            <h3 className="text-lg font-bold font-serif mb-6 border-b border-black pb-2">분석에 사용된 핵심 기사</h3>
            <div className="flex flex-col gap-6">
              {[1, 2, 3].map((num) => (
                <article key={num} className="group cursor-pointer border-b border-gray-200 pb-6 last:border-0">
                  <div className="text-[11px] font-bold text-[#e63946] mb-1">경제</div>
                  <h4 className="text-[15px] font-bold leading-snug mb-2 group-hover:underline">폭염에 AI 전력난 겹쳤다... 전력기기株 들썩</h4>
                  <div className="text-[11px] text-gray-400">2026.10.01</div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}