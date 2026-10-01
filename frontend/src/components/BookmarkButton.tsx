"use client";

import React from 'react';
import { Bookmark } from 'lucide-react';

export default function BookmarkButton({ size = 18 }: { size?: number }) {
  return (
    <button 
      onClick={(e) => {
        e.preventDefault();
        alert("북마크에 저장되었습니다.");
      }}
      className="text-gray-400 hover:text-black flex items-center transition"
    >
      <Bookmark size={size} />
    </button>
  );
}