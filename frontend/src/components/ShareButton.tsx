"use client";

import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/**
 * 모바일 등 공유 기능이 있는 브라우저에서는 기본 공유 창을 열고,
 * 그렇지 않으면 현재 페이지 주소를 클립보드에 복사합니다.
 */
export default function ShareButton({ title, size = 20 }: { title: string; size?: number }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // 사용자가 공유 창을 닫은 경우는 그대로 종료합니다.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없을 때는 아무 동작도 하지 않습니다.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="공유하기"
      title={copied ? '링크가 복사되었습니다' : '공유하기'}
      className="hover:text-black transition flex items-center gap-1"
    >
      {copied ? <Check size={size} className="text-green-600" /> : <Share2 size={size} />}
      {copied && <span className="text-xs text-green-600">링크 복사됨</span>}
    </button>
  );
}
