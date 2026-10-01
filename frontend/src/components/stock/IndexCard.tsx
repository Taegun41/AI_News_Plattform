import React from 'react';
import { IndexCard as IndexCardData, changeColor, formatChange, formatNumber, formatShortDate } from '@/lib/stock';

const CHART_WIDTH = 240;
const CHART_HEIGHT = 56;

/** 최근 거래일 종가로 그리는 미니 차트 (전일 종가 기준선 포함) */
function Sparkline({ id, history, isUp }: { id: string; history: IndexCardData['history']; isUp: boolean }) {
  if (history.length < 2) return null;

  const closes = history.map((h) => h.close);
  const prevClose = closes[closes.length - 2];
  const min = Math.min(...closes, prevClose);
  const max = Math.max(...closes, prevClose);
  const range = max - min || 1;

  const x = (i: number) => (i / (closes.length - 1)) * CHART_WIDTH;
  const y = (v: number) => CHART_HEIGHT - 4 - ((v - min) / range) * (CHART_HEIGHT - 8);

  const line = closes.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;
  const color = isUp ? '#e02f3a' : '#2f6fdf';
  const gradientId = `spark-${id}`;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="w-full h-14"
      role="img"
      aria-label={`최근 ${closes.length}거래일 추이`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        x2={CHART_WIDTH}
        y1={y(prevClose)}
        y2={y(prevClose)}
        stroke="#9ca3af"
        strokeDasharray="2 3"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function IndexCard({ data }: { data: IndexCardData }) {
  const isUp = data.change >= 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-sm font-bold text-gray-700">{data.name}</p>
      <p className="text-2xl font-bold tracking-tight">{formatNumber(data.close, 2)}</p>
      <p className={`text-sm font-medium ${changeColor(data.change)}`}>
        {formatChange(data.change, data.change_ratio, 2)}
      </p>
      <div className="mt-3">
        <Sparkline id={data.code} history={data.history} isUp={isUp} />
      </div>
      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
        {formatShortDate(data.date)}
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${data.status === '장중' ? 'bg-green-500' : 'bg-gray-300'}`} />
        {data.status}
        <span className="ml-auto">최근 {data.history.length}거래일</span>
      </p>
    </div>
  );
}
