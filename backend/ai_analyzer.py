import os
import json
import time
import difflib
import traceback
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

class Track2AIOutput(BaseModel):
    """Gemini에게 요청하는 응답 형식. (검색어·메타 정보는 코드에서 직접 채우므로 제외)"""
    theme_summary: str
    detailed_viewpoints: list[str]
    impact_analysis: str
    key_urls: list[str]
# ----------------------------------------------------

# --- [Gemini 호출 공통 설정] ---
# 기본 모델과, 기본 모델이 혼잡(503)할 때 번갈아 시도할 예비 모델 목록.
# .env 또는 GitHub Secrets/환경변수로 바꿀 수 있습니다. (예: GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite)
PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
FALLBACK_MODELS = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash").split(",") if m.strip()]

# 재시도 사이 대기 시간(초). Gemini 혼잡은 보통 몇 분 안에 풀리므로 점점 길게 기다립니다. (합계 약 12분)
TRACK1_RETRY_WAITS = [20, 40, 60, 120, 180, 300]
TRACK1_STEP2_RETRY_WAITS = [20, 60, 120]  # 2단계(교차 분석)는 없어도 리포트가 만들어지므로 짧게

_TRANSIENT_MARKERS = ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "500", "INTERNAL", "DEADLINE", "timed out", "Timeout")
_MODEL_MISSING_MARKERS = ("404", "NOT_FOUND", "is not found", "not supported")


def generate_json_with_retry(contents, schema, label, retry_waits, api_client=None):
    """
    Gemini에 JSON 응답을 요청하고, 실패하면 기다렸다가 다시 시도합니다.
    - 시도할 때마다 기본 모델 → 예비 모델 순으로 번갈아 사용합니다.
    - 존재하지 않는 모델(404)은 목록에서 빼고 바로 다음 모델로 넘어갑니다.
    성공하면 파싱된 JSON, 끝내 실패하면 None을 돌려줍니다.
    """
    api_client = api_client or client
    models = list(dict.fromkeys([PRIMARY_MODEL] + FALLBACK_MODELS))
    total_attempts = len(retry_waits) + 1
    attempt = 0

    while attempt < total_attempts and models:
        model = models[attempt % len(models)]
        try:
            response = api_client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema
                )
            )
            if not response.text:
                raise ValueError("Gemini가 빈 응답을 반환했습니다. (안전 필터에 걸렸을 수 있습니다)")
            result = json.loads(response.text)
            if model != PRIMARY_MODEL:
                print(f"[{label}] 예비 모델 {model}로 성공했습니다.")
            return result
        except Exception as e:
            message = str(e)
            if any(marker in message for marker in _MODEL_MISSING_MARKERS) and model != PRIMARY_MODEL:
                print(f"[{label}] 예비 모델 {model}을(를) 사용할 수 없어 목록에서 제외합니다: {message[:120]}")
                models.remove(model)
                continue  # 시도 횟수를 쓰지 않고 바로 다음 모델로

            print(f"오류: {label} 중 문제 발생 (시도 {attempt + 1}/{total_attempts}, 모델 {model}) - {message[:300]}")
            if attempt < len(retry_waits):
                wait = retry_waits[attempt]
                kind = "일시적 혼잡으로 보입니다. " if any(m in message for m in _TRANSIENT_MARKERS) else ""
                print(f"  → {kind}{wait}초 후 다시 시도합니다.")
                time.sleep(wait)
            attempt += 1

    return None
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
        news_text += f"[{idx+1}] 제목: {article.get('title')}\nURL: {article.get('url')}\n내용: {(article.get('body') or '')[:200]}...\n\n"

    prompt_step1 = f"""
    다음은 오늘 수집된 뉴스 기사들입니다. 이 기사들을 '정치', '경제', '사회', 'IT/과학', '세계' 등의 분야(sector_name)로 분류하고, 
    각 분야별로 핵심 이슈(issue_name)를 묶어주세요.
    
    [뉴스 기사]
    {news_text}
    """

    # 1단계: 분야별 클러스터링 (Gemini 혼잡에 대비해 최대 약 12분간 재시도)
    refined_sectors = generate_json_with_retry(prompt_step1, list[SectorReport], "1단계 분석", TRACK1_RETRY_WAITS)
    if not refined_sectors:
        print("1단계 분석이 끝내 실패했습니다.")
        return None

    # --- [핵심 추가 로직] 원본 기사의 썸네일 URL을 AI 결과물에 병합 ---
    thumb_dict = {article.get('url'): article.get('thumbnail_url') for article in raw_news_data}
    for sector in refined_sectors:
        for issue in sector['issues']:
            main_url = issue.get('main_article_url')
            # 매핑되는 썸네일이 없으면 방어적으로 Unsplash 기본 이미지 삽입
            issue['thumbnail_url'] = thumb_dict.get(main_url) or "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1200&auto=format&fit=crop"
    print("[1단계 완료] 분야별 정제가 성공적으로 끝났습니다.")

    if not refined_sectors:
        return None

    print("\n[트랙 1 - 2단계] 분야 간 교차 분석을 시작합니다...")
    
    prompt_step2 = f"""
    다음은 1단계에서 분류된 분야별 핵심 이슈들입니다.
    이 이슈들 간의 연관성을 분석하여 교차 테마(CrossCorrelation)를 도출해주세요.
    
    [분야별 이슈]
    {json.dumps(refined_sectors, ensure_ascii=False)}
    """

    # 2단계: 교차 분석 (실패해도 1단계 결과로 리포트는 만듭니다)
    cross_correlations = generate_json_with_retry(prompt_step2, list[CrossCorrelation], "2단계 교차 분석", TRACK1_STEP2_RETRY_WAITS)
    if cross_correlations is None:
        print("2단계 분석 실패. 1단계 결과만 반환합니다.")
        cross_correlations = []
    else:
        print("[2단계 완료] 교차 분석이 성공적으로 끝났습니다.")

    return {
        "sectors": refined_sectors,
        "cross_correlations": cross_correlations
    }
    
def calculate_similarity(text1, text2):
    return difflib.SequenceMatcher(None, text1, text2).ratio()


# 트랙 2에서 AI에게 보내는 기사 수와 기사당 본문 길이 (토큰 사용량·응답 속도 조절용)
TRACK2_MAX_CANDIDATES = 60      # 중복 검사 대상 최대 기사 수 (최신순)
TRACK2_BODY_CHARS = 1500        # AI에게 보내는 기사당 본문 최대 글자 수
TRACK2_SIMILARITY_CHARS = 800   # 중복 검사에 사용하는 본문 앞부분 글자 수


def run_track2_dynamic_search(keyword, raw_news_data, api_key, max_articles=15):
    """
    [트랙 2] DB에서 이미 키워드로 걸러진 기사들 중, 본문 유사도가 80% 미만인 독립적인 기사들만 추려
    맞춤형 리포트를 생성합니다.
    """
    if not raw_news_data:
        return {"error": "뉴스 원본 데이터가 없습니다."}
    if not api_key:
        return {"error": "GEMINI_API_KEY가 설정되지 않았습니다. backend/.env 파일을 확인해주세요."}

    track2_client = genai.Client(api_key=api_key)

    # DB 검색(db_client.search_raw_news_within_week)에서 이미 단어별·띄어쓰기 무시 매칭을 끝냈으므로
    # 여기서는 다시 거르지 않습니다. (예전에는 검색어 전체 문자열로 다시 걸러서 여러 단어 검색이 실패했습니다)
    keyword_matched_news = raw_news_data[:TRACK2_MAX_CANDIDATES]

    unique_news = []
    for new_article in keyword_matched_news:
        new_body = (new_article.get('body') or '')[:TRACK2_SIMILARITY_CHARS]
        is_duplicate = False
        for existing_article in unique_news:
            existing_body = (existing_article.get('body') or '')[:TRACK2_SIMILARITY_CHARS]
            if calculate_similarity(new_body, existing_body) >= 0.8:
                is_duplicate = True
                break
        if not is_duplicate:
            unique_news.append(new_article)
        if len(unique_news) >= max_articles:
            break

    # AI에게는 분석에 필요한 필드만, 본문은 적당히 잘라서 보냅니다.
    articles_for_ai = [
        {
            "title": article.get('title'),
            "url": article.get('url'),
            "date": article.get('date'),
            "sector": article.get('theme_sector'),
            "body": (article.get('body') or '')[:TRACK2_BODY_CHARS],
        }
        for article in unique_news
    ]

    prompt_step2_dynamic = f"""
    당신은 사용자 맞춤형 금융 비서입니다. 사용자가 '{keyword}' 테마에 대해 검색했습니다.
    제공된 뉴스들은 텍스트 유사도 검사를 거쳐 중복 내용이 제거된 독립적인 기사들입니다.

    지침:
    1. theme_summary: 이 테마의 전반적인 핵심 이슈를 요약하세요.
    2. detailed_viewpoints: 기사들이 다루는 세부적인 관점이나 팩트를 개별 리스트로 나열하세요.
    3. impact_analysis: 이 이슈가 관련 산업이나 시장에 미칠 영향을 분석하세요.
    4. key_urls: 참고한 기사들의 실제 URL을 모두 포함하세요. (가짜 URL 생성 절대 금지)

    분석할 고순도 뉴스 데이터:
    {json.dumps(articles_for_ai, ensure_ascii=False)}
    """

    max_retries = 3
    last_error = None
    for attempt in range(max_retries):
        try:
            response = track2_client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt_step2_dynamic,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Track2AIOutput
                )
            )
            if not response.text:
                raise ValueError("Gemini가 빈 응답을 반환했습니다. (안전 필터에 걸렸을 수 있습니다)")

            report_data = json.loads(response.text)
            report_data['search_keyword'] = keyword
            report_data['meta_info'] = f"총 {len(raw_news_data)}건 검색, 중복 제거 후 {len(unique_news)}건 요약 완료"

            # 실제로 제공한 기사 URL만 남겨서 AI가 지어낸 URL을 걸러냅니다.
            valid_urls = {article.get('url') for article in unique_news}
            report_data['key_urls'] = [url for url in report_data.get('key_urls', []) if url in valid_urls]

            # 프론트엔드 우측 리스트에 띄우기 위해 날짜 최신순으로 정렬합니다.
            unique_news.sort(key=lambda x: x.get('date') or '', reverse=True)

            return {
                "ai_report": report_data,
                "articles": unique_news
            }
        except Exception as e:
            last_error = e
            print(f"[트랙 2 오류] '{keyword}' AI 분석 실패 (시도 {attempt + 1}/{max_retries}): {e}")
            traceback.print_exc()
            if attempt < max_retries - 1:
                # 요청 한도 초과(429)나 일시적 서버 오류(503)에 대비해 점점 길게 기다렸다가 재시도합니다.
                time.sleep(3 * (attempt + 1))

    return {"error": f"AI 분석 중 오류 발생: {last_error}"}
