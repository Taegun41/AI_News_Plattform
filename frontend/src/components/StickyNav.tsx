"use client"; 

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StickyNav() {
  const menus = ['홈', '정치', '경제', '사회', 'IT/과학', '세계', '오피니언'];
  
  const pathname = usePathname();
  const currentPath = decodeURIComponent(pathname);

  return (
    <nav className="sticky top-0 z-50 bg-[#f7f6f2] border-y border-black/20">
      <div className="max-w-[1200px] mx-auto px-6">
        <ul className="flex justify-center gap-12 py-3 text-sm font-bold text-gray-600">
          {menus.map((menu, idx) => {
            const urlSlug = menu.replace('/', '-');
            const href = menu === '홈' ? '/' : `/${urlSlug}`;
            const isActive = currentPath === href;

            return (
              <li key={idx} className="pb-3 -mb-3 flex">
                <Link 
                  href={href}
                  className={`cursor-pointer transition ${
                    isActive 
                      ? 'text-black border-b-2 border-[#e63946]' 
                      : 'hover:text-black'
                  }`}
                >
                  {menu}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}