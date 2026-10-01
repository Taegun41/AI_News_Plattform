import time
import random
import datetime
import requests

# 한국 표준시(UTC+9). 한국은 서머타임이 없어 고정 오프셋으로 충분합니다.
KST = datetime.timezone(datetime.timedelta(hours=9))


def now_kst():
    """
    서버가 어느 나라 시간대로 설정돼 있든 항상 '한국 시간' 기준 현재 시각을 돌려줍니다.
    (클라우드 서버·GitHub Actions는 보통 UTC라서 datetime.now()를 쓰면 9시간 어긋납니다)
    다른 코드와 비교하기 쉽도록 시간대 정보는 뗀 일반 datetime으로 반환합니다.
    """
    return datetime.datetime.now(KST).replace(tzinfo=None)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
]

def get_secure_session():
    """
    호출될 때마다 랜덤한 브라우저(User-Agent)로 위장된 세션을 반환합니다.
    """
    session = requests.Session()
    session.headers.update({
        'User-Agent': random.choice(USER_AGENTS),
        'Referer': 'https://news.naver.com/'
    })
    return session

def random_delay(min_sec=1.0, max_sec=2.5):
    """
    기계적인 접속을 피하기 위해 랜덤한 시간 동안 대기합니다.
    """
    time.sleep(random.uniform(min_sec, max_sec))


def split_search_terms(keyword, max_terms=5):
    """
    검색어를 단어 단위로 나눕니다. (중복 제거, 최대 5개)
    예: '르노 코리아' → ['르노', '코리아']
    """
    terms = []
    for term in (keyword or '').split():
        term = term.strip()
        if term and term.lower() not in [t.lower() for t in terms]:
            terms.append(term)
    return terms[:max_terms]


def count_matched_terms(article, terms):
    """
    기사 제목+본문에 검색어 단어가 몇 개 들어 있는지 셉니다. (대소문자·띄어쓰기 무시)
    띄어쓰기를 무시하므로 '르노 코리아'로 검색해도 '르노코리아'라고 쓴 기사가 찾아집니다.
    """
    text = ((article.get('title') or '') + ' ' + (article.get('body') or '')).lower()
    text_no_space = ''.join(text.split())
    return sum(1 for term in terms if ''.join(term.lower().split()) in text_no_space)
