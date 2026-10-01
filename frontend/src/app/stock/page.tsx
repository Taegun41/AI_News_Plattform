import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Info } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import IndexCard from '@/components/stock/IndexCard';
import StockRanking, { RankingTab } from '@/components/stock/StockRanking';
import StockDatePicker from '@/components/stock/StockDatePicker';
import { fetchStockDates, fetchStockOverview, formatNumber, formatTradeDate } from '@/lib/stock';

export const metadata: Metadata = {
  title: '주식 확인',
};

export default async function StockPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  // /stock?date=2026-09-25 처럼 날짜를 지정하면 그 거래일, 없으면 최신 거래일을 보여줍니다.
  const { date } = await searchParams;
  const requestedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  const overview = await fetchStockOverview(requestedDate);
  // 요청한 날짜에 데이터가 없을 때 안내용으로 저장된 날짜 목록을 따로 가져옵니다.
  const fallbackDates = overview ? [] : await fetchStockDates();

  const tabs: RankingTab[] = overview
    ? [
        {
          key: 'upper',
          label: '상한가',
          description: '종가가 가격제한폭(+30%) 상한에 도달한 종목 · 거래대금 순',
          items: overview.upper_limit,
        },
        {
          key: 'lower',
          label: '하한가',
          description: '종가가 가격제한폭(-30%) 하한에 도달한 종목 · 거래대금 순',
          items: overview.lower_limit,
        },
        {
          key: 'surge',
          label: `${overview.criteria.surge_ratio}% 이상 상승`,
          description: `전일 대비 ${overview.criteria.surge_ratio}% 이상 오른 종목 · 상승률 순 (신규 상장 종목 포함)`,
          items: overview.surge,
        },
        {
          key: 'volume',
          label: `거래량 ${formatNumber(overview.criteria.volume / 10000)}만 이상`,
          description: `거래량 ${formatNumber(overview.criteria.volume / 10000)}만 주 이상 종목 · 거래량 순`,
          items: overview.high_volume,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#f2f2ee] text-[#1a1a1a] font-sans">
      <SiteHeader />

      <main className="max-w-[1000px] mx-auto px-6 pb-16 flex flex-col gap-6">
        {/* 제목 + 날짜 선택 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t-[3px] border-black pt-4">
          <div>
            <p className="text-xs font-bold text-[#e63946] uppercase tracking-widest">Market</p>
            <h2 className="text-2xl font-bold font-serif">주식 확인</h2>
          </div>
          {overview && overview.available_dates.length > 0 && (
            <StockDatePicker selectedDate={overview.trade_date} availableDates={overview.available_dates} />
          )}
        </div>

        {!overview && fallbackDates.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-500">
            <p>{requestedDate ? `${formatTradeDate(requestedDate)} 주식 데이터가 없습니다.` : '주식 데이터를 불러오지 못했습니다.'}</p>
            <p className="text-sm mt-2 text-gray-400">
              주말·공휴일이거나 데이터를 수집하지 않은 날입니다. 저장된 날짜: {fallbackDates.map(formatTradeDate).join(', ')}
            </p>
            <Link href="/stock" className="inline-block mt-5 text-sm font-bold text-[#e63946] hover:underline">
              최신 데이터 보기 →
            </Link>
          </div>
        ) : !overview ? (
          <div className="bg-white rounded-xl border border-gray-200 py-20 text-center text-gray-500">
            <p>저장된 주식 데이터가 없습니다.</p>
            <p className="text-sm mt-2 text-gray-400">
              backend 폴더에서 <code className="bg-gray-100 px-1.5 py-0.5 rounded">python main.py --stock</code> 으로 수집해주세요.
            </p>
          </div>
        ) : (
          <>
            {/* 코스피 · 코스닥 */}
            {overview.indices.length > 0 && (
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {overview.indices.map((index) => (
                  <IndexCard key={index.code} data={index} />
                ))}
              </section>
            )}

            {/* 기준일 안내 */}
            <div
              className={`rounded-xl px-5 py-4 text-sm flex items-start gap-2 ${
                overview.is_intraday ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              <Info size={16} className="mt-0.5 shrink-0" />
              <p>
                <b className="text-gray-900">{formatTradeDate(overview.trade_date)} 장 마감 기준</b>
                {!overview.is_latest ? (
                  <>
                    {' · 지난 날짜의 시세를 보고 있습니다. '}
                    <Link href="/stock" className="font-bold text-[#e63946] hover:underline">최신 데이터로 →</Link>
                  </>
                ) : overview.is_today ? (
                  ' · 오늘 장 마감 후 확정된 시세입니다.'
                ) : (
                  ' · 장 마감 전에는 전 거래일 시세를 보여드립니다. 당일 시세는 장 마감 후(16:00) 갱신됩니다.'
                )}
                {overview.is_legacy && !overview.is_intraday && (
                  <span className="block mt-1 text-gray-400">
                    예전 방식으로 저장된 데이터라 수집 시각에 따라 실제 종가와 조금 다를 수 있습니다.
                  </span>
                )}
                {overview.is_intraday && (
                  <span className="block mt-1">
                    이 데이터는 장중({overview.collected_at.slice(11, 16)})에 수집되어 실제 종가와 다를 수 있습니다.
                  </span>
                )}
              </p>
            </div>

            {/* 특징 종목 */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="text-2xl font-bold">특징 종목</h2>
                <span className="text-xs text-gray-400">
                  코스피·코스닥 {formatNumber(overview.total_stocks)}개 종목 중
                </span>
              </div>
              <StockRanking tabs={tabs} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
