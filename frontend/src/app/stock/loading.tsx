import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f2f2ee] text-[#1a1a1a]">
      <SiteHeader />
      <main className="max-w-[1000px] mx-auto px-6 py-32 flex flex-col items-center justify-center text-gray-500">
        <Loader2 className="animate-spin text-[#e63946] mb-4" size={40} />
        <p>주식 데이터를 불러오는 중입니다...</p>
      </main>
    </div>
  );
}
