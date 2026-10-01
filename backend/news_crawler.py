import os
import json
import datetime
from bs4 import BeautifulSoup
from utils import get_secure_session, random_delay

# 분야 코드를 한글 테마명으로 변환하기 위한 딕셔너리
SECTION_MAP = {
    "100": "정치",
    "101": "경제",
    "102": "사회",
    "104": "세계",
    "105": "IT/과학"
}

def fetch_news_urls(section_id="101", target_count=10):
    """
    지정된 분야의 기사 URL을 target_count 개수만큼 페이지를 넘기며 수집합니다.
    """
    urls = set()
    page = 1
    
    while len(urls) < target_count:
        url = f"https://news.naver.com/main/list.naver?mode=LSD&mid=sec&sid1={section_id}&page={page}"
        session = get_secure_session() # 페이지를 넘길 때도 브라우저 신분을 바꿉니다.
        
        try:
            response = session.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            page_urls = []
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                if "n.news.naver.com/mnews/article/" in href:
                    clean_url = href.split('?')[0]
                    page_urls.append(clean_url)
            
            new_urls = set(page_urls) - urls
            
            # 마지막 페이지에 도달하여 더 이상 새로운 기사가 없으면 탐색 종료
            if not new_urls:
                break
                
            urls.update(new_urls)
            page += 1
            random_delay(0.5, 1.5)
            
        except Exception as e:
            print(f"URL 목록 수집 중 오류 발생: {e}")
            break
            
    # set은 순서가 없으므로 리스트로 변환 후 정확히 target_count 개수만 잘라서 반환합니다.
    return list(urls)[:target_count]


def parse_news_article(url, section_id):
    """
    단일 네이버 뉴스 기사에서 제목, 본문, 작성일, 그리고 테마 섹터를 추출합니다.
    """
    session = get_secure_session() # 기사 본문을 읽을 때마다 새로운 브라우저로 위장합니다.
    
    try:
        response = session.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        title_element = soup.select_one('#title_area span')
        body_element = soup.select_one('#dic_area')
        date_element = soup.select_one('.media_end_head_info_datestamp_time')
        
        title = title_element.text.strip() if title_element else "제목 없음"
        body = body_element.get_text(separator=' ', strip=True) if body_element else "본문 없음"
        date = date_element.attrs.get('data-date-time', '날짜 없음') if date_element else "날짜 없음"
        
        return {
            'theme_sector': SECTION_MAP.get(section_id, '기타'), # AI 분석을 돕기 위한 섹터 태그 추가
            'url': url,
            'title': title,
            'body': body,
            'date': date
        }

    except Exception as e:
        print(f"[{url}] 크롤링 중 오류 발생: {e}")
        return None


def save_news_to_json(news_list, file_path):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(news_list, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    print("경제 섹션 최신 기사 URL 수집 단독 테스트를 시작합니다...")
    
    test_section = "101"
    target_urls = fetch_news_urls(section_id=test_section, target_count=10)
    print(f"총 {len(target_urls)}개의 기사 URL을 찾았습니다.\n")
    
    crawled_data = []
    
    for i, url in enumerate(target_urls, 1):
        print(f"[{i}/{len(target_urls)}] 수집 중: {url}")
        article_data = parse_news_article(url, test_section) 
        
        if article_data:
            crawled_data.append(article_data)
        
        random_delay(1.0, 2.5)
        
    if crawled_data:
        now = datetime.datetime.now()
        year_month = now.strftime('%Y-%m')
        today_str = now.strftime('%Y%m%d')
        
        # 변경된 경로: archive_data/news/년-월
        archive_dir = os.path.join("archive_data", "news", year_month)
        os.makedirs(archive_dir, exist_ok=True)
        
        file_name = os.path.join(archive_dir, f'naver_economy_news_{today_str}.json')
        save_news_to_json(crawled_data, file_name)
        print(f"\n단독 테스트 완료! 결과가 {file_name}에 저장되었습니다.")