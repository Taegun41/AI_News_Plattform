import React from 'react';
import { formatReportDate, todayInSeoul } from '@/lib/api';

/**
 * 리포트 기준 날짜를 보여줍니다.
 * 오늘 06:00 리포트가 아직 만들어지기 전이면 이전 리포트라는 안내를 함께 띄웁니다.
 */
export default function ReportDateNotice({ reportDate }: { reportDate?: string | null }) {
  if (!reportDate) return null;
  const isToday = reportDate === todayInSeoul();

  return (
    <span className={`text-xs ${isToday ? 'text-gray-400' : 'text-amber-700'}`}>
      {isToday
        ? `${formatReportDate(reportDate)} 리포트`
        : `${formatReportDate(reportDate)} 리포트 · 오늘 리포트는 매일 오전 6시에 갱신됩니다`}
    </span>
  );
}
