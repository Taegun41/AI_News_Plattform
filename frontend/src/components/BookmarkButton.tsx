"use client";

import React, { useSyncExternalStore } from 'react';
import { Bookmark } from 'lucide-react';
import {
  BookmarkItem,
  getBookmarksSnapshot,
  getServerBookmarksSnapshot,
  parseBookmarks,
  subscribeBookmarks,
  toggleBookmark,
} from '@/lib/bookmarks';

interface BookmarkButtonProps {
  item: Omit<BookmarkItem, 'saved_at'>;
  size?: number;
  className?: string;
}

export default function BookmarkButton({ item, size = 18, className = '' }: BookmarkButtonProps) {
  const raw = useSyncExternalStore(subscribeBookmarks, getBookmarksSnapshot, getServerBookmarksSnapshot);
  const isSaved = parseBookmarks(raw).some((b) => b.url === item.url);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(item);
      }}
      aria-pressed={isSaved}
      aria-label={isSaved ? '북마크 해제' : '북마크에 저장'}
      title={isSaved ? '북마크 해제' : '북마크에 저장'}
      className={`flex items-center transition ${
        isSaved ? 'text-[#e63946]' : 'text-gray-400 hover:text-black'
      } ${className}`}
    >
      <Bookmark size={size} fill={isSaved ? 'currentColor' : 'none'} />
    </button>
  );
}
