import os
from dotenv import load_dotenv
from supabase import create_client, Client

# .env 파일의 내용을 환경변수로 불러옴
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
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

def search_raw_news_by_keyword(keyword: str, date_str: str = None):
    """
    제목(title)이나 본문(body)에 키워드가 포함된 기사를 DB에서 검색합니다.
    선택적으로 특정 날짜(YYYY.MM.DD 등 뉴스 포맷에 맞게)의 기사만 필터링할 수 있습니다.
    """
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