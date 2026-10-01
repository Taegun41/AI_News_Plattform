import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a]">
      <SiteHeader />
      <StickyNav />
      <main className="max-w-[1200px] mx-auto px-6 py-32 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-[#e63946] mb-4" size={48} />
        <h2 className="text-2xl font-bold font-serif mb-2">관련 기사를 찾고 있습니다</h2>
        <p className="text-gray-500">최근 7일 동안 수집된 기사를 검색하는 중입니다...</p>
      </main>
    </div>
  );
}