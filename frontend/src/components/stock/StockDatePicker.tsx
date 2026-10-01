"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTradeDate } from '@/lib/stock';

interface StockDatePickerProps {
  selectedDate: string; // 현재 보고 있는 거래일 (YYYY-MM-DD)
  availableDates: string[]; // 데이터가 있는 거래일 (오래된 순)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function goToDate(router: ReturnType<typeof useRouter>, date: string, latest: string) {
  // 최신 날짜는 주소를 깔끔하게 /stock 으로 둡니다.
  router.push(date === latest ? '/stock' : `/stock?date=${date}`);
}

export default function StockDatePicker({ selectedDate, availableDates }: StockDatePickerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [selYear, selMonth] = selectedDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(selYear);
  const [viewMonth, setViewMonth] = useState(selMonth - 1); // 0~11

  const available = new Set(availableDates);
  const latest = availableDates[availableDates.length - 1] ?? selectedDate;
  const oldest = availableDates[0] ?? selectedDate;
  const currentIdx = availableDates.indexOf(selectedDate);
  const prevDate = currentIdx > 0 ? availableDates[currentIdx - 1] : null;
  const nextDate = currentIdx >= 0 && currentIdx < availableDates.length - 1 ? availableDates[currentIdx + 1] : null;

  // 달력 바깥을 클릭하거나 ESC를 누르면 닫습니다.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const openCalendar = () => {
    // 열 때마다 현재 선택한 날짜가 있는 달을 보여줍니다.
    setViewYear(selYear);
    setViewMonth(selMonth - 1);
    setIsOpen((prev) => !prev);
  };

  const moveMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  // 데이터가 있는 범위 밖의 달로는 이동하지 않습니다.
  const viewKey = `${viewYear}-${pad(viewMonth + 1)}`;
  const canGoPrevMonth = viewKey > oldest.slice(0, 7);
  const canGoNextMonth = viewKey < latest.slice(0, 7);

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const navButton =
    'w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white transition disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-gray-50';

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <button
        type="button"
        className={navButton}
        disabled={!prevDate}
        onClick={() => prevDate && goToDate(router, prevDate, latest)}
        aria-label="이전 거래일"
        title={prevDate ? `이전 거래일 (${formatTradeDate(prevDate)})` : '이전 데이터 없음'}
      >
        <ChevronLeft size={18} />
      </button>

      <button
        type="button"
        onClick={openCalendar}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="h-9 px-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition text-sm font-bold"
      >
        <CalendarDays size={16} className="text-[#e63946]" />
        {formatTradeDate(selectedDate)}
        <ChevronDown size={14} className={`text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <button
        type="button"
        className={navButton}
        disabled={!nextDate}
        onClick={() => nextDate && goToDate(router, nextDate, latest)}
        aria-label="다음 거래일"
        title={nextDate ? `다음 거래일 (${formatTradeDate(nextDate)})` : '가장 최근 데이터입니다'}
      >
        <ChevronRight size={18} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="날짜 선택"
          className="absolute right-0 top-11 z-40 w-[296px] bg-white rounded-xl border border-gray-200 shadow-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              disabled={!canGoPrevMonth}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="이전 달"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold">
              {viewYear}년 {viewMonth + 1}월
            </span>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              disabled={!canGoNextMonth}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="다음 달"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={`text-[11px] font-bold py-1 ${i === 0 ? 'text-[#e02f3a]' : i === 6 ? 'text-[#2f6fdf]' : 'text-gray-400'}`}
              >
                {w}
              </span>
            ))}
            {cells.map((day, idx) => {
              if (day === null) return <span key={`empty-${idx}`} />;
              const key = toKey(viewYear, viewMonth, day);
              const hasData = available.has(key);
              const isSelected = key === selectedDate;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!hasData}
                  onClick={() => {
                    setIsOpen(false);
                    goToDate(router, key, latest);
                  }}
                  className={`h-9 rounded-lg text-sm transition ${
                    isSelected
                      ? 'bg-[#e63946] text-white font-bold'
                      : hasData
                        ? 'font-bold text-gray-900 hover:bg-[#e63946]/10'
                        : 'text-gray-300 cursor-default'
                  }`}
                  aria-label={`${viewMonth + 1}월 ${day}일${hasData ? '' : ' (데이터 없음)'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>진한 날짜만 데이터가 있습니다 · 총 {availableDates.length}일</span>
            {selectedDate !== latest && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  goToDate(router, latest, latest);
                }}
                className="font-bold text-[#e63946] hover:underline"
              >
                최신으로
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
