import os
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai_analyzer import run_track2_dynamic_search
# 방금 db_client.py에 추가한 함수들을 불러옵니다.
from db_client import get_track1_report_by_date, search_raw_news_by_keyword

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class KeywordRequest(BaseModel):
    keyword: str

@app.get("/api/daily-report")
def get_daily_report():
    """
    프론트엔드 첫 화면용 리포트 전송 API.
    이제 로컬 파일이 아닌 Supabase DB에서 오늘 날짜의 리포트를 꺼내옵니다.
    """
    # 리포트 테이블에 저장된 형식(YYYY-MM-DD)으로 오늘 날짜 문자열 생성
    today_str = datetime.datetime.now().strftime('%Y-%m-%d')
    
    report_data = get_track1_report_by_date(today_str)
    
    if not report_data:
        # 만약 아직 오늘 리포트가 생성 안 됐다면, 어제 날짜로 한 번 더 시도하는 유연성을 줄 수도 있습니다.
        raise HTTPException(status_code=404, detail="오늘의 리포트가 아직 생성되지 않았습니다.")
        
    return report_data

@app.post("/api/search-theme")
def search_theme(request: KeywordRequest):
    """
    사용자가 특정 키워드를 검색했을 때의 API.
    DB에서 관련 기사를 검색(ilike)하여 AI 분석기에 넘깁니다.
    """
    API_KEY = os.getenv("GEMINI_API_KEY")
    
    # 1. DB 단에서 키워드와 관련된 기사만 1차로 필터링해서 가져옵니다. 
    # (로컬 전체 파일을 파이썬 for문으로 돌리는 방식에서 탈피)
    matched_news = search_raw_news_by_keyword(request.keyword)
    
    if not matched_news:
         raise HTTPException(status_code=404, detail=f"'{request.keyword}' 관련 뉴스를 데이터베이스에서 찾을 수 없습니다.")
         
    # 2. 검색된 기사 리스트를 트랙 2 AI 분석기에 전달합니다. 
    # (ai_analyzer.py의 run_track2_dynamic_search 함수 내부에서 다시 for문으로 keyword를 검사하던 로직은 
    # 이제 DB에서 이미 필터링해 왔으므로 통과되거나 생략되어도 무방합니다.)
    result = run_track2_dynamic_search(request.keyword, matched_news, API_KEY)
    
    # 만약 에러가 포함되어 반환되었다면 프론트엔드에도 에러를 던집니다.
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result