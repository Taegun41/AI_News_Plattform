import React from 'react';
import { Search } from 'lucide-react';

export default function SiteHeader() {
  return (
    <header className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex justify-between items-center">
        <div className="w-1/3">
          <p className="text-xs text-gray-500 font-medium">2026년 10월 1일 목요일</p>
          <p className="text-xs text-gray-400 mt-1">부산 24° 맑음</p>
        </div>
        <div className="w-1/3 text-center">
          <h1 className="text-4xl font-black tracking-tighter uppercase font-serif">
            AI News
          </h1>
          <p className="text-[10px] tracking-[0.2em] font-bold text-gray-500 mt-2">
            NEWS & INSIGHT
          </p>
        </div>
        <div className="w-1/3 flex justify-end items-center gap-4">
          <button className="p-2 hover:bg-gray-200 rounded-full transition">
            <Search size={20} />
          </button>
          <button className="bg-[#e63946] text-white px-5 py-2 text-sm font-bold rounded-sm hover:bg-red-700 transition">
            구독하기
          </button>
        </div>
      </div>
    </header>
  );
}