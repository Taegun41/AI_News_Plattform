"use client";

import React, { useSyncExternalStore } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import StickyNav from '@/components/StickyNav';
import { DEFAULT_THUMBNAIL } from '@/lib/api';
import {
  getBookmarksSnapshot,
  getServerBookmarksSnapshot,
  parseBookmarks,
  removeBookmark,
  subscribeBookmarks,
} from '@/lib/bookmarks';

export default function BookmarksPage() {
  const raw = useSyncExternalStore(subscribeBookmarks, getBookmarksSnapshot, getServerBookmarksSnapshot);
  const bookmarks = parseBookmarks(raw);

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1a1a1a] font-sans selection:bg-[#e63946] selection:text-white">
      <SiteHeader />
      <StickyNav />

      <main className="max-w-[900px] mx-auto px-6 py-12">
        <div className="mb-10 border-b-[3px] border-black pb-4">
          <h2 className="text-4xl font-serif font-black">내 북마크</h2>
          <p className="text-gray-500 mt-2">
            저장한 이슈는 이 브라우저에 보관됩니다. 랭킹은 매일 바뀌므로 대표 원문 기사로 연결됩니다.
          </p>
        </div>

        {bookmarks.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            아직 저장한 이슈가 없습니다. 기사 옆의 북마크 아이콘을 눌러 저장해 보세요.
          </div>
        ) : (
          <ul className="flex flex-col border-t border-black">
            {bookmarks.map((item) => (
              <li key={item.url} className="border-b border-gray-200 py-5 flex gap-5 items-start">
                <a href={item.url} target="_blank" rel="noreferrer" className="group flex gap-5 flex-1 min-w-0">
                  <div className="w-28 aspect-[4/3] bg-gray-200 overflow-hidden shrink-0">
                    <img
                      src={item.thumbnail_url || DEFAULT_THUMBNAIL}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] mb-1">
                      {item.sector && <span className="font-bold text-[#e63946]">{item.sector}</span>}
                      <span className="text-gray-400">
                        {new Date(item.saved_at).toLocaleDateString('ko-KR')} 저장
                      </span>
                    </div>
                    <h3 className="text-lg font-bold group-hover:underline leading-snug line-clamp-2 flex items-center gap-1">
                      {item.title}
                      <ExternalLink size={14} className="shrink-0 text-gray-400" />
                    </h3>
                    {item.summary && <p className="text-sm text-gray-500 line-clamp-2 mt-1">{item.summary}</p>}
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => removeBookmark(item.url)}
                  aria-label="북마크 삭제"
                  title="북마크 삭제"
                  className="text-gray-400 hover:text-[#e63946] transition mt-1"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
