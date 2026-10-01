import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db_client import (
    get_track1_report_by_date,
    get_latest_track1_report,
    get_raw_news_by_url,
    get_raw_news_summaries_by_urls,
    search_raw_news_within_week,
    sanitize_keyword,
)
from utils import split_search_terms, count_matched_terms, now_kst
from stock_service import get_stock_overview, get_available_dates

# 참고: AI 요약 검색(트랙 2, ai_analyzer.run_track2_dynamic_search)은 Gemini 응답 지연 문제로
# 현재 사용하지 않습니다. 코드는 ai_analyzer.py에 그대로 남아 있어 나중에 다시 연결할 수 있습니다.

load_dotenv()

# 이 줄이 반드시 add_middleware 위에 있어야 합니다.
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


class UrlRequest(BaseModel):
    url: str


class UrlsRequest(BaseModel):
    urls: list[str]


SNIPPET_RADIUS = 90  # 검색어 앞뒤로 보여줄 글자 수


def make_snippet(body: str, terms: list[str]) -> str:
    """본문에서 검색어가 처음 나오는 부분을 중심으로 짧은 미리보기 문장을 만듭니다."""
    body = ' '.join((body or '').split())
    if not body:
        return ''

    lower_body = body.lower()
    positions = [lower_body.find(term.lower()) for term in terms]
    positions = [p for p in positions if p >= 0]

    if not positions:
        # 띄어쓰기 차이 등으로 위치를 못 찾으면 본문 앞부분을 보여줍니다.
        return body[:SNIPPET_RADIUS * 2] + ('…' if len(body) > SNIPPET_RADIUS * 2 else '')

    center = min(positions)
    start = max(0, center - SNIPPET_RADIUS)
    end = min(len(body), center + SNIPPET_RADIUS)
    return ('…' if start > 0 else '') + body[start:end] + ('…' if end < len(body) else '')


@app.post("/api/raw-news")
def get_raw_news(request: UrlRequest):
    """URL을 기반으로 DB에서 기사 원본(본문 포함)을 가져오는 API"""
    news = get_raw_news_by_url(request.url)
    if not news:
        raise HTTPException(status_code=404, detail="원본 기사를 찾을 수 없습니다.")
    return news


@app.post("/api/raw-news-batch")
def get_raw_news_batch(request: UrlsRequest):
    """여러 URL의 기사 제목·날짜·분야를 한 번에 돌려주는 API (관련 기사 목록 표시용)"""
    urls = list(dict.fromkeys(request.urls))[:50]  # 중복 제거, 최대 50개
    return get_raw_news_summaries_by_urls(urls)


@app.get("/api/daily-report")
def get_daily_report():
    """
    프론트엔드 첫 화면용 리포트 전송 API.
    오늘(매일 06:00 생성) 리포트가 있으면 그것을, 아직 없으면 가장 최근 리포트를 돌려줍니다.
    """
    today_str = now_kst().strftime('%Y-%m-%d')

    report_data = get_track1_report_by_date(today_str)
    if not report_data:
        report_data = get_latest_track1_report()

    if not report_data:
        raise HTTPException(status_code=404, detail="생성된 리포트가 아직 없습니다.")

    return report_data


@app.post("/api/search-theme")
def search_theme(request: KeywordRequest):
    """
    최근 7일 이내 기사 중 검색어와 관련된 기사를 전부 최신순으로 돌려줍니다. (AI 호출 없음)

    - match_type 'all'     : 검색어의 모든 단어가 들어간 기사들
    - match_type 'partial' : 모든 단어가 들어간 기사가 없어서, 일부 단어만 맞는 기사들
    """
    keyword = sanitize_keyword(request.keyword)
    if not keyword:
        raise HTTPException(status_code=400, detail="검색어를 입력해주세요.")

    terms = split_search_terms(keyword)
    matched_news = search_raw_news_within_week(keyword)

    if not matched_news:
        raise HTTPException(status_code=404, detail=f"'{keyword}' 관련 최근 7일 기사를 찾을 수 없습니다.")

    is_full_match = count_matched_terms(matched_news[0], terms) == len(terms)

    # 목록에는 본문 전체 대신 검색어 주변 미리보기만 보냅니다. (응답 크기 축소)
    articles = [
        {
            "url": article.get('url'),
            "title": article.get('title'),
            "date": article.get('date'),
            "theme_sector": article.get('theme_sector'),
            "thumbnail_url": article.get('thumbnail_url'),
            "snippet": make_snippet(article.get('body'), terms),
        }
        for article in matched_news
    ]

    return {
        "keyword": keyword,
        "terms": terms,
        "match_type": "all" if is_full_match else "partial",
        "total": len(articles),
        "articles": articles,
    }


@app.get("/api/stock/overview")
def stock_overview(date: str | None = None):
    """
    주식 페이지용 데이터. (예: /api/stock/overview?date=2026-09-25)
    date가 없으면 가장 최근 '확정' 거래일 기준(장 마감 전에는 전 거래일, 16:00 이후에는 당일)입니다.
    상한가 / 하한가 / 15% 이상 상승 / 거래량 1000만주 이상 종목과 코스피·코스닥 지수를 돌려줍니다.
    """
    if date:
        try:
            datetime.datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")

    overview = get_stock_overview(date)
    if not overview:
        if date and get_available_dates():
            raise HTTPException(status_code=404, detail=f"{date} 주식 데이터가 없습니다.")
        raise HTTPException(status_code=404, detail="저장된 주식 데이터가 없습니다. 'python main.py --stock'으로 수집해주세요.")
    return overview


@app.get("/api/stock/dates")
def stock_dates():
    """주식 데이터가 저장된 거래일 목록 (달력에서 선택 가능한 날짜)"""
    return {"dates": get_available_dates()}
