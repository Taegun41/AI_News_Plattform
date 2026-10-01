"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, LineChart, Newspaper, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

// 날씨를 보여줄 도시 (Open-Meteo: API 키가 필요 없는 무료 날씨 API)
const WEATHER_CITY = { name: '부산', latitude: 35.1796, longitude: 129.0756 };

/** WMO 날씨 코드 → 한글 설명 */
function describeWeather(code: number): string {
  if (code === 0) return '맑음';
  if (code <= 2) return '구름 조금';
  if (code === 3) return '흐림';
  if (code === 45 || code === 48) return '안개';
  if (code >= 51 && code <= 57) return '이슬비';
  if (code >= 61 && code <= 67) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 80 && code <= 82) return '소나기';
  if (code >= 85 && code <= 86) return '눈 소나기';
  if (code >= 95) return '뇌우';
  return '';
}

function formatTodayKorean(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
}

export default function SiteHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [weather, setWeather] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  // 주식 페이지에서는 버튼이 '뉴스 보기'로, 그 외 페이지에서는 '주식 확인'으로 바뀝니다.
  const isStockPage = pathname.startsWith('/stock');

  useEffect(() => {
    const controller = new AbortController();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_CITY.latitude}` +
      `&longitude=${WEATHER_CITY.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;

    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const current = data?.current;
        if (!current) return;
        const temp = Math.round(current.temperature_2m);
        setWeather(`${WEATHER_CITY.name} ${temp}° ${describeWeather(current.weather_code)}`.trim());
      })
      .catch(() => {
        // 날씨를 못 가져와도 헤더는 정상적으로 보이도록 무시합니다.
      });

    return () => controller.abort();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      router.push(`/search?q=${encodeURIComponent(keyword.trim())}`);
      setIsSearchOpen(false);
      setKeyword('');
    }
  };

  return (
    <header className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex justify-between items-center">
        {/* 좌측 날짜·날씨 영역 */}
        <div className="w-1/3">
          {/* 서버와 브라우저의 시각이 자정 무렵 달라질 수 있어 경고를 숨깁니다. */}
          <p className="text-xs text-gray-500 font-medium" suppressHydrationWarning>
            {formatTodayKorean()}
          </p>
          <p className="text-xs text-gray-400 mt-1 min-h-[1rem]">{weather ?? ''}</p>
        </div>

        {/* 중앙 로고 */}
        <div className="w-1/3 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-black tracking-tighter uppercase font-serif">
              AI News
            </h1>
            <p className="text-[10px] tracking-[0.2em] font-bold text-gray-500 mt-2">
              NEWS & INSIGHT
            </p>
          </Link>
        </div>

        {/* 우측 유틸리티 */}
        <div className="w-1/3 flex justify-end items-center gap-4 relative">
          {isSearchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2 transition-all">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="관심 테마 검색"
                maxLength={50}
                className="border-b border-gray-400 outline-none px-2 py-1 text-sm w-40 bg-transparent focus:border-[#e63946] transition-colors"
                autoFocus
              />
              <button type="submit" aria-label="검색" className="p-1 hover:text-[#e63946] transition">
                <Search size={18} />
              </button>
              <button
                type="button"
                aria-label="검색창 닫기"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 text-gray-400 hover:text-black transition"
              >
                <X size={18} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              aria-label="검색 열기"
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              <Search size={20} />
            </button>
          )}

          <Link
            href="/bookmarks"
            aria-label="내 북마크"
            title="내 북마크"
            className="p-2 hover:bg-gray-200 rounded-full transition"
          >
            <Bookmark size={20} />
          </Link>

          <Link
            href={isStockPage ? '/' : '/stock'}
            className="bg-[#e63946] text-white px-5 py-2 text-sm font-bold rounded-sm hover:bg-red-700 transition flex items-center gap-1.5 whitespace-nowrap"
          >
            {isStockPage ? (
              <>
                <Newspaper size={16} /> 뉴스 보기
              </>
            ) : (
              <>
                <LineChart size={16} /> 주식 확인
              </>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
