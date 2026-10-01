"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  StockItem,
  changeColor,
  formatAmount,
  formatChange,
  formatMarcap,
  formatNumber,
  formatVolume,
} from '@/lib/stock';

export interface RankingTab {
  key: string;
  label: string;
  description: string; // 탭 아래에 보여줄 기준 설명
  items: StockItem[];
}

const INITIAL_COUNT = 10;

// 종목 로고 대신 쓰는 동그란 이니셜 아이콘 색상
const AVATAR_COLORS = ['#e63946', '#1d4ed8', '#0f766e', '#7c3aed', '#c2410c', '#0369a1', '#4d7c0f', '#be185d'];

function avatarColor(code: string): string {
  const sum = code.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export default function StockRanking({ tabs }: { tabs: RankingTab[] }) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const [expanded, setExpanded] = useState(false);

  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  if (!active) return null;

  const visibleItems = expanded ? active.items : active.items.slice(0, INITIAL_COUNT);

  return (
    <div>
      {/* 탭 */}
      <div className="flex flex-wrap gap-2 mb-2" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.key === active.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveKey(tab.key);
                setExpanded(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                isActive ? 'bg-[#1a1a1a] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                {tab.items.length}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mb-5">{active.description}</p>

      {active.items.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm border-t border-gray-200">
          해당 조건에 맞는 종목이 없습니다.
        </div>
      ) : (
        <>
          {/* 표 머리글 */}
          <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_9rem_8rem_7rem] gap-3 text-xs text-gray-500 border-b border-gray-200 pb-2 px-1">
            <span />
            <span>종목</span>
            <span className="text-right">종가</span>
            <span className="hidden sm:block text-right">거래량 · 대금</span>
            <span className="hidden sm:block text-right">시가총액</span>
          </div>

          <ol>
            {visibleItems.map((item, idx) => (
              <li
                key={item.code}
                className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_9rem_8rem_7rem] gap-3 items-center py-3.5 px-1 border-b border-gray-100 last:border-0"
              >
                <span className="text-base font-bold text-gray-800 text-center">{idx + 1}</span>

                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: avatarColor(item.code) }}
                    aria-hidden
                  >
                    {item.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <a
                      href={`https://finance.naver.com/item/main.naver?code=${item.code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block font-bold text-[15px] text-gray-900 truncate hover:underline"
                      title={`${item.name} 네이버 증권에서 보기`}
                    >
                      {item.name}
                    </a>
                    <p className="text-xs text-gray-400">
                      {item.code}
                      <span className="ml-1.5 text-[10px] px-1 py-px rounded bg-gray-100 text-gray-500">
                        {item.market === 'KOSPI' ? '코스피' : '코스닥'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-[15px]">{formatNumber(item.close)}</p>
                  <p className={`text-xs ${changeColor(item.change)}`}>
                    {formatChange(item.change, item.change_ratio)}
                  </p>
                </div>

                <div className="hidden sm:block text-right">
                  <p className="font-bold text-[15px]">{formatVolume(item.volume)}</p>
                  <p className="text-xs text-gray-400">{formatAmount(item.amount)}</p>
                </div>

                <p className="hidden sm:block text-right font-bold text-[15px]">{formatMarcap(item.marcap)}</p>
              </li>
            ))}
          </ol>

          {active.items.length > INITIAL_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="w-full mt-4 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-sm font-medium text-gray-700 flex items-center justify-center gap-1"
            >
              {expanded ? (
                <>접기 <ChevronUp size={16} /></>
              ) : (
                <>더보기 ({active.items.length - INITIAL_COUNT}개) <ChevronDown size={16} /></>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
