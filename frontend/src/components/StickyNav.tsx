"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SECTORS, sectorToPath } from '@/lib/api';

const MENUS = [
  { label: '홈', href: '/' },
  ...SECTORS.map((sector) => ({ label: sector, href: sectorToPath(sector) })),
  { label: '랭킹', href: '/ranking' },
  { label: 'AI 인사이트', href: '/insight' },
];

export default function StickyNav() {
  const pathname = usePathname();
  const currentPath = decodeURIComponent(pathname);

  return (
    <nav className="sticky top-0 z-50 bg-[#f7f6f2] border-y border-black/20">
      <div className="max-w-[1200px] mx-auto px-6 overflow-x-auto">
        <ul className="flex justify-start md:justify-center gap-8 md:gap-12 py-3 text-sm font-bold text-gray-600 whitespace-nowrap">
          {MENUS.map((menu) => {
            const isActive = currentPath === menu.href;

            return (
              <li key={menu.href} className="pb-3 -mb-3 flex">
                <Link
                  href={menu.href}
                  className={`cursor-pointer transition ${
                    isActive ? 'text-black border-b-2 border-[#e63946]' : 'hover:text-black'
                  }`}
                >
                  {menu.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
