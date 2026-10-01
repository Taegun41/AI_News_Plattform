import os
import json
import time
import difflib
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

# 환경 변수 로드 및 Gemini 클라이언트 초기화
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

# --- [Pydantic 스키마 정의] 프론트엔드와 동일한 구조 ---
class IssueCluster(BaseModel):
    issue_name: str
    article_count: int
    summary: str
    main_article_url: str
    related_urls: list[str]

class SectorReport(BaseModel):
    sector_name: str
    issues: list[IssueCluster]

class CrossCorrelation(BaseModel):
    correlation_theme: str
    description: str
    related_sectors: list[str]
    key_urls: list[str]

class Track2Report(BaseModel):
    search_keyword: str
    theme_summary: str
    detailed_viewpoints: list[str]
    impact_analysis: str
    key_urls: list[str]
    meta_info: str | None = None
# ----------------------------------------------------

def run_track1_daily_clustering(raw_news_data):
    """
    [트랙 1] 원본 뉴스 데이터를 받아 분야별 클러스터링 및 교차 분석을 수행합니다.
    """
    if not raw_news_data:
        print("분석할 뉴스 데이터가 없습니다.")
        return None

    print("\n[트랙 1 - 1단계] 분야별 기사 정제 및 클러스터링을 시작합니다...")
    
    # AI에게 전달할 뉴스 텍스트 생성
    news_text = ""
    for idx, article in enumerate(raw_news_data):
        news_text += f"[{idx+1}] 제목: {article.get('title')}\nURL: {article.get('url')}\n내용: {article.get('body')[:200]}...\n\n"

    prompt_step1 = f"""
    다음은 오늘 수집된 뉴스 기사들입니다. 이 기사들을 '정치', '경제', '사회', 'IT/과학', '세계' 등의 분야(sector_name)로 분류하고, 
    각 분야별로 핵심 이슈(issue_name)를 묶어주세요.
    
    [뉴스 기사]
    {news_text}
    """

    refined_sectors = None
    max_retries = 3
    
    # 1단계: 분야별 클러스터링
    for attempt in range(max_retries):
        try:
            response_step1 = client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt_step1,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[SectorReport]
                )
            )
            refined_sectors = json.loads(response_step1.text)
            
            # --- [핵심 추가 로직] 원본 기사의 썸네일 URL을 AI 결과물에 병합 ---
            thumb_dict = {article.get('url'): article.get('thumbnail_url') for article in raw_news_data}
            
            for sector in refined_sectors:
                for issue in sector['issues']:
                    main_url = issue.get('main_article_url')
                    # 매핑되는 썸네일이 없으면 방어적으로 Unsplash 기본 이미지 삽입
                    issue['thumbnail_url'] = thumb_dict.get(main_url) or "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1200&auto=format&fit=crop"
            # -----------------------------------------------------------------
            
            print("[1단계 완료] 분야별 정제가 성공적으로 끝났습니다.")
            break
        except Exception as e:
            print(f"오류: 1단계 분석 중 문제 발생. (시도 {attempt + 1}/{max_retries}) - {e}")
            if attempt < max_retries - 1:
                time.sleep(15 * (attempt + 1))
            else:
                return None

    if not refined_sectors:
        return None

    print("\n[트랙 1 - 2단계] 분야 간 교차 분석을 시작합니다...")
    
    prompt_step2 = f"""
    다음은 1단계에서 분류된 분야별 핵심 이슈들입니다.
    이 이슈들 간의 연관성을 분석하여 교차 테마(CrossCorrelation)를 도출해주세요.
    
    [분야별 이슈]
    {json.dumps(refined_sectors, ensure_ascii=False)}
    """

    cross_correlations = []
    
    # 2단계: 교차 분석
    for attempt in range(max_retries):
        try:
            response_step2 = client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt_step2,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[CrossCorrelation]
                )
            )
            cross_correlations = json.loads(response_step2.text)
            print("[2단계 완료] 교차 분석이 성공적으로 끝났습니다.")
            break
        except Exception as e:
            print(f"오류: 2단계 분석 중 문제 발생. (시도 {attempt + 1}/{max_retries}) - {e}")
            if attempt < max_retries - 1:
                time.sleep(15 * (attempt + 1))
            else:
                print("2단계 분석 실패. 1단계 결과만 반환합니다.")
                break

    return {
        "sectors": refined_sectors,
        "cross_correlations": cross_correlations
    }
    
def calculate_similarity(text1, text2):
    return difflib.SequenceMatcher(None, text1, text2).ratio()


def run_track2_dynamic_search(keyword, raw_news_data, api_key, max_articles=15):
    """
    [트랙 2] 키워드 검색 후, 본문 유사도가 80% 미만인 독립적인 기사들만 추려 맞춤형 리포트를 생성합니다.
    """
    client = genai.Client(api_key=api_key)
    
    if not raw_news_data:
        return {"error": "뉴스 원본 데이터가 없습니다."}

    keyword_matched_news = []
    for article in raw_news_data:
        if keyword in article.get('title', '') or keyword in article.get('body', ''):
            keyword_matched_news.append(article)
            
    if not keyword_matched_news:
        return {"error": f"'{keyword}' 관련 기사를 찾을 수 없습니다."}

    unique_news = []
    for new_article in keyword_matched_news:
        is_duplicate = False
        for existing_article in unique_news:
            similarity = calculate_similarity(new_article['body'], existing_article['body'])
            if similarity >= 0.8:
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique_news.append(new_article)
            
    unique_news = unique_news[:max_articles]

    prompt_step2_dynamic = f"""
    당신은 사용자 맞춤형 금융 비서입니다. 사용자가 '{keyword}' 테마에 대해 검색했습니다.
    제공된 뉴스들은 텍스트 유사도 검사를 거쳐 중복 내용이 제거된 독립적인 기사들입니다.
    
    지침:
    1. theme_summary: 이 테마의 전반적인 핵심 이슈를 요약하세요.
    2. detailed_viewpoints: 기사들이 다루는 세부적인 관점이나 팩트를 개별 리스트로 나열하세요.
    3. impact_analysis: 이 이슈가 관련 산업이나 시장에 미칠 영향을 분석하세요.
    4. key_urls: 참고한 기사들의 실제 URL을 모두 포함하세요. (가짜 URL 생성 절대 금지)
    
    분석할 고순도 뉴스 데이터:
    {json.dumps(unique_news, ensure_ascii=False)}
    """

    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt_step2_dynamic,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=Track2Report
            )
        )
        report_data = json.loads(response.text)
        report_data['search_keyword'] = keyword
        report_data['meta_info'] = f"총 {len(keyword_matched_news)}건 검색, 중복 제거 후 {len(unique_news)}건 요약 완료"
        return report_data
    except Exception as e:
        return {"error": f"AI 분석 중 오류 발생: {str(e)}"}