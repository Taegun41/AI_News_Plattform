import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function FutureSection() {
  return (
    <section className="max-w-[1200px] mx-auto px-6 py-10 border-t border-gray-300">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-xs font-bold text-[#e63946] uppercase tracking-widest mb-2">Analysis</div>
          <h2 className="text-2xl font-bold font-serif">시장 흐름 분석 (주식 연동 예정)</h2>
        </div>
        <button className="text-xs font-bold flex items-center gap-1 hover:text-[#e63946]">
          분석 전체보기 <ArrowRight size={14} />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-48 bg-gray-200 rounded-sm animate-pulse flex items-center justify-center text-gray-400 text-sm">
            데이터 연동 대기 중...
          </div>
        ))}
      </div>
    </section>
  );
}