import json
import datetime
import difflib
import time
from google import genai
from google.genai import types
from pydantic import BaseModel
from db_client import insert_track1_report_to_db

# --- 1차 분석 스키마 (분야별 뉴스 정제) ---
class IssueCluster(BaseModel):
    issue_name: str
    article_count: int
    summary: str
    main_article_url: str
    related_urls: list[str]

class SectorReport(BaseModel):
    sector_name: str
    issues: list[IssueCluster]

# --- 2차 분석 스키마 (교차 연관도 도출) ---
class CrossCorrelation(BaseModel):
    correlation_theme: str
    description: str
    related_sectors: list[str]
    key_urls: list[str]

# --- 트랙 2 분석 스키마 (동적 키워드 탐색) ---
class Track2Report(BaseModel):
    search_keyword: str
    theme_summary: str
    detailed_viewpoints: list[str]
    impact_analysis: str
    key_urls: list[str]


def run_track1_daily_clustering(raw_news_data, api_key):
    """
    [트랙 1] 1단계: 분야별 뉴스 정제 -> 2단계: 교차 연관도 분석
    """
    client = genai.Client(api_key=api_key)
    
    if not raw_news_data:
        print("분석할 뉴스 데이터가 없습니다.")
        return None

    # --- [1단계] 분야별 뉴스 정제 및 클러스터링 ---
    print("\n[트랙 1 - 1단계] 분야별 기사 정제 및 클러스터링을 시작합니다...")
    
    prompt_step1 = f"""
    당신은 데이터 분류 전문가입니다. 제공된 뉴스 데이터를 'theme_sector' 기준으로 분류하세요.
    각 분야(경제, 정치, IT/과학 등) 내에서 주제가 동일한 기사들을 묶어 이슈(issue_name)를 만들고, 
    해당 이슈에 속한 기사의 총 개수(article_count)를 세어주세요.
    반드시 기사 수가 많은 이슈부터 내림차순으로 정렬하여 반환하세요.
    
    [절대 지켜야 할 제약사항]
    1. 반드시 원본 뉴스 데이터에 존재하는 실제 'url'만 추출하세요. 절대 example.com 같은 가상의 주소를 지어내지 마세요.
    2. 모든 내용은 한국어로 작성하세요.
    
    원본 뉴스 데이터:
    {json.dumps(raw_news_data, ensure_ascii=False)}
    """
    
    refined_sectors = None
    max_retries = 3
    
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

    # --- [2단계] 교차 연관도 도출 ---
    print("\n[트랙 1 - 2단계] 정제된 데이터를 바탕으로 교차 연관도 분석을 시작합니다...")
    
    prompt_step2 = f"""
    당신은 거시 경제 분석가입니다. 1차로 정제된 분야별 리포트를 보고 서로 다른 분야 간의 연관성을 찾으세요.
    
    [절대 지켜야 할 제약사항]
    1. 1차 정제된 데이터 요약본에 존재하는 실제 URL만 추출해서 key_urls에 넣으세요. 가상의 URL은 절대 불가합니다.
    2. related_sectors 항목은 'Technology', 'Finance' 같은 영어가 아닌 'IT/과학', '경제' 등 한글 섹터명으로 작성하세요.
    3. 억지로 연결하지 말고, 실제로 강한 연관성이 있는 경우에만 추출하세요.
    
    1차 정제된 데이터 요약본:
    {json.dumps(refined_sectors, ensure_ascii=False)}
    """
    
    cross_correlations = None
    
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
            print("[2단계 완료] 교차 연관도 분석이 성공적으로 끝났습니다.")
            break
        except Exception as e:
            print(f"오류: 2단계 분석 중 문제 발생. (시도 {attempt + 1}/{max_retries}) - {e}")
            if attempt < max_retries - 1:
                time.sleep(15 * (attempt + 1))
            else:
                return None

    # --- [3단계] 최종 데이터 병합 및 DB 저장 ---
    final_report = {
        "report_date": datetime.datetime.now().strftime('%Y-%m-%d'),
        "sectors": refined_sectors,
        "cross_correlations": cross_correlations if cross_correlations else []
    }
    
    insert_track1_report_to_db(final_report)
    print("\n[트랙 1 최종 완료] 모든 분석이 끝나고 DB에 저장되었습니다.")
    return final_report


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