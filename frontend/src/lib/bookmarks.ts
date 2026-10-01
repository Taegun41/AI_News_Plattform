/**
 * 브라우저(localStorage)에 저장하는 북마크.
 * 로그인 기능이 없으므로 기기·브라우저별로 따로 저장됩니다.
 */

export interface BookmarkItem {
  url: string; // 대표 원문 기사 URL (북마크를 구분하는 키)
  title: string;
  summary?: string;
  sector?: string;
  thumbnail_url?: string;
  saved_at: string; // ISO 날짜
}

const STORAGE_KEY = 'ai-news-bookmarks';
const CHANGE_EVENT = 'ai-news-bookmarks-change';

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

export function parseBookmarks(raw: string): BookmarkItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: BookmarkItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // 저장 공간이 막혀 있는 환경(사생활 보호 모드 등)에서는 조용히 무시합니다.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** useSyncExternalStore용: 북마크 변경(같은 탭/다른 탭)을 구독합니다. */
export function subscribeBookmarks(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** useSyncExternalStore용 스냅샷 (문자열이라 값이 같으면 다시 그리지 않습니다) */
export function getBookmarksSnapshot(): string {
  return readRaw();
}

export function getServerBookmarksSnapshot(): string {
  return '[]';
}

export function toggleBookmark(item: Omit<BookmarkItem, 'saved_at'>): boolean {
  const items = parseBookmarks(readRaw());
  const exists = items.some((b) => b.url === item.url);
  if (exists) {
    write(items.filter((b) => b.url !== item.url));
    return false;
  }
  write([{ ...item, saved_at: new Date().toISOString() }, ...items]);
  return true;
}

export function removeBookmark(url: string) {
  write(parseBookmarks(readRaw()).filter((b) => b.url !== url));
}
