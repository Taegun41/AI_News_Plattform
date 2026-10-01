import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import CoreNews from '@/components/CoreNews';
import FutureSection from '@/components/FutureSection';
import { fetchDailyReport } from '@/lib/api';

export default async function Home() {
  // DB에서 오늘의 리포트 전체를 가져옵니다.
  const report = await fetchDailyReport();

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />
      <main>
        {/* 가져온 리포트 데이터를 CoreNews 컴포넌트로 전달합니다. */}
        <CoreNews report={report} />
        <FutureSection />
      </main>
    </div>
  );
}