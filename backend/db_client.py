import os
import re
import datetime

from dotenv import load_dotenv
from supabase import create_client, Client

from utils import split_search_terms, count_matched_terms, now_kst

# .env 파일의 내용을 환경변수로 불러옴
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def sanitize_keyword(keyword: str) -> str:
    """
    Supabase(PostgREST)의 or_ 필터 문자열에 그대로 들어가도 안전하도록 검색어를 정리합니다.
    쉼표·괄호·따옴표·백슬래시 등은 필터 문법을 깨뜨리므로 공백으로 바꾸고,
    %, *, _ 같은 와일드카드 문자도 제거합니다.
    """
    if not keyword:
        return ""
    cleaned = re.sub(r'[,()"\\%*_]', ' ', keyword)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:50]

def search_raw_news_within_week(keyword: str, max_candidates: int = 300):
    """
    키워드와 관련된 최근 7일 이내 기사를 최신순으로 검색합니다.

    - 검색어를 단어별로 나눠서 찾습니다. ('르노 코리아' → '르노', '코리아')
    - 모든 단어가 들어간 기사가 있으면 그것만 돌려줍니다.
    - 없으면 단어가 하나라도 들어간 기사를, 많이 맞는 순서로 돌려줍니다.
    - 띄어쓰기는 무시하고 비교하므로 '르노코리아'라고 쓴 기사도 찾아집니다.
    """
    keyword = sanitize_keyword(keyword)
    terms = split_search_terms(keyword)
    if not terms:
        return []

    # DB 조건: 각 단어 + (여러 단어일 때) 띄어쓰기를 뺀 검색어 중 하나라도 제목/본문에 포함
    patterns = list(terms)
    compact = ''.join(terms)
    if len(terms) > 1 and compact not in patterns:
        patterns.append(compact)
    or_filter = ','.join(
        f"title.ilike.%{p}%,body.ilike.%{p}%" for p in patterns
    )

    try:
        # 오늘 기준 7일 전 날짜 문자열 생성 (예: 2026-09-24)
        seven_days_ago = (now_kst() - datetime.timedelta(days=7)).strftime('%Y-%m-%d')

        response = supabase.table('raw_news').select('*') \
            .or_(or_filter) \
            .gte('date', seven_days_ago) \
            .order('date', desc=True) \
            .limit(max_candidates) \
            .execute()
        candidates = response.data or []
    except Exception as e:
        print(f"[DB 검색 실패] 최근 7일 기사 검색 오류: {e}")
        return []

    scored = [(count_matched_terms(article, terms), article) for article in candidates]
    scored = [(score, article) for score, article in scored if score > 0]
    if not scored:
        return []

    full_matches = [article for score, article in scored if score == len(terms)]
    if full_matches:
        return full_matches

    # 정렬은 안정 정렬이므로, 맞은 단어 수가 같으면 최신순이 유지됩니다.
    scored.sort(key=lambda x: x[0], reverse=True)
    return [article for _, article in scored]


def insert_raw_news_to_db(news_list):
    """크롤링된 기사 원본을 raw_news 테이블에 저장하되, 중복된 URL은 무시합니다."""
    try:
        # on_conflict='url'을 기준으로 중복을 검사하고, 중복시 무시(ignore_duplicates=True)합니다.
        data, count = supabase.table('raw_news').upsert(
            news_list, 
            on_conflict='url', 
            ignore_duplicates=True
        ).execute()
        print(f"[DB 저장 완료] 원본 기사 처리가 안전하게 완료되었습니다.")
        return True
    except Exception as e:
        print(f"[DB 저장 실패] 원본 기사 저장 중 오류 발생: {e}")
        return False

def insert_track1_report_to_db(report_data):
    """AI 분석이 끝난 트랙 1 결과물을 track1_reports 테이블에 저장합니다."""
    try:
        data, count = supabase.table('track1_reports').insert(report_data).execute()
        print("[DB 저장 완료] 트랙 1 AI 분석 리포트가 성공적으로 저장되었습니다.")
        return True
    except Exception as e:
        print(f"[DB 저장 실패] 트랙 1 리포트 저장 중 오류 발생: {e}")
        return False    

# ----------------- 새로 추가되는 조회(Select) 로직 -----------------

def get_track1_report_by_date(date_str: str):
    """특정 날짜(YYYY-MM-DD)의 트랙 1 리포트를 DB에서 조회합니다."""
    try:
        # report_date 컬럼이 입력받은 날짜와 일치하는 가장 최신 리포트 1개를 가져옵니다.
        response = supabase.table('track1_reports') \
            .select('*') \
            .eq('report_date', date_str) \
            .order('id', desc=True) \
            .limit(1) \
            .execute()
        
        if response.data:
            return response.data[0] # 첫 번째 결과(딕셔너리) 반환
        return None
    except Exception as e:
        print(f"[DB 조회 실패] 리포트 불러오기 오류: {e}")
        return None

def get_latest_track1_report():
    """날짜와 상관없이 가장 최근에 생성된 트랙 1 리포트를 조회합니다."""
    try:
        response = supabase.table('track1_reports') \
            .select('*') \
            .order('report_date', desc=True) \
            .order('id', desc=True) \
            .limit(1) \
            .execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"[DB 조회 실패] 최신 리포트 불러오기 오류: {e}")
        return None


def get_raw_news_summaries_by_urls(urls: list[str]):
    """여러 URL의 기사 제목·날짜·분야를 한 번에 조회합니다. (본문 제외, 관련 기사 목록용)"""
    if not urls:
        return []
    try:
        response = supabase.table('raw_news') \
            .select('url,title,date,theme_sector,thumbnail_url') \
            .in_('url', urls) \
            .execute()
        return response.data or []
    except Exception as e:
        print(f"[DB 조회 실패] 관련 기사 목록 조회 오류: {e}")
        return []


def search_raw_news_by_keyword(keyword: str, date_str: str = None):
    """
    제목(title)이나 본문(body)에 키워드가 포함된 기사를 DB에서 검색합니다.
    선택적으로 특정 날짜(YYYY.MM.DD 등 뉴스 포맷에 맞게)의 기사만 필터링할 수 있습니다.
    """
    keyword = sanitize_keyword(keyword)
    if not keyword:
        return []
    try:
        # ilike 연산자를 사용해 앞뒤로 어떤 문자열이든 키워드가 포함된(wildcard) 데이터를 찾습니다.
        query = supabase.table('raw_news').select('*').or_(f"title.ilike.%{keyword}%,body.ilike.%{keyword}%")
        
        # 날짜 조건이 있다면 추가합니다 (현재 뉴스 데이터의 'date' 컬럼 형식을 확인하고 맞추면 좋습니다)
        if date_str:
            query = query.ilike('date', f"%{date_str}%")
            
        response = query.execute()
        return response.data
    except Exception as e:
        print(f"[DB 검색 실패] 기사 검색 오류: {e}")
        return []
    
    
def get_raw_news_by_url(url: str):
    """URL을 이용해 원본 기사 데이터를 DB에서 조회합니다."""
    try:
        response = supabase.table('raw_news').select('*').eq('url', url).limit(1).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"[DB 조회 실패] 원본 기사 조회 오류: {e}")
        return None


# ----------------- 주식 데이터 (stock_daily, stock_prices 테이블) -----------------

STOCK_PRICE_BATCH_SIZE = 500  # 한 번에 저장하는 종목 수 (요청 크기 제한 대비)


def upsert_stock_daily(record: dict):
    """거래일별 요약(지수, 상한가/하한가/급등/거래량 목록)을 저장합니다. 같은 날짜는 덮어씁니다."""
    try:
        supabase.table('stock_daily').upsert(record, on_conflict='trade_date').execute()
        print(f"[DB 저장 완료] {record.get('trade_date')} 주식 요약 저장")
        return True
    except Exception as e:
        print(f"[DB 저장 실패] 주식 요약 저장 중 오류 발생: {e}")
        return False


def upsert_stock_prices(rows: list[dict]):
    """전 종목 시세를 저장합니다. (거래일+종목코드가 같으면 덮어씀, 500개씩 나눠 저장)"""
    try:
        for start in range(0, len(rows), STOCK_PRICE_BATCH_SIZE):
            batch = rows[start:start + STOCK_PRICE_BATCH_SIZE]
            supabase.table('stock_prices').upsert(batch, on_conflict='trade_date,code').execute()
        print(f"[DB 저장 완료] 전 종목 시세 {len(rows)}건 저장")
        return True
    except Exception as e:
        print(f"[DB 저장 실패] 전 종목 시세 저장 중 오류 발생: {e}")
        return False


def get_stock_daily(trade_date: str | None = None):
    """특정 거래일(YYYY-MM-DD)의 주식 요약을 조회합니다. 날짜가 없으면 가장 최근 거래일."""
    try:
        query = supabase.table('stock_daily').select('*')
        if trade_date:
            query = query.eq('trade_date', trade_date)
        else:
            query = query.order('trade_date', desc=True)
        response = query.limit(1).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"[DB 조회 실패] 주식 요약 조회 오류: {e}")
        return None


def get_stock_dates():
    """주식 데이터가 저장된 거래일 목록 (오래된 순)"""
    try:
        response = supabase.table('stock_daily') \
            .select('trade_date') \
            .order('trade_date') \
            .limit(5000) \
            .execute()
        return [row['trade_date'] for row in (response.data or [])]
    except Exception as e:
        print(f"[DB 조회 실패] 주식 날짜 목록 조회 오류: {e}")
        return []

