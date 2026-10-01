import os
import time
import datetime
import schedule

from utils import random_delay
from news_crawler import fetch_news_urls, parse_news_article, save_news_to_json
from stock_crawler import fetch_all_stock_data, save_dataframe_to_csv
from ai_analyzer import run_track1_daily_clustering
from db_client import insert_raw_news_to_db

def run_daily_job():
    # 1. 현재 시간을 기준으로 날짜 정보 추출
    now = datetime.datetime.now()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')
    year_month = now.strftime('%Y-%m') 
    today_file_str = now.strftime('%Y%m%d') 
    
    # 2. archive_data 하위에 백업용 news와 stock 폴더 설정
    archive_news_dir = os.path.join("archive_data", "news", year_month)
    archive_stocks_dir = os.path.join("archive_data", "stock", year_month)
    
    os.makedirs(archive_news_dir, exist_ok=True)
    os.makedirs(archive_stocks_dir, exist_ok=True)
    
    print(f"\n--- [시작] {now_str} 일일 데이터 심층 수집 가동 ---")
    
    print("\n1. 한국거래소(KRX) 전체 주식 데이터 수집 중...")
    stock_df = fetch_all_stock_data()
    if stock_df is not None:
        stock_csv_file = os.path.join(archive_stocks_dir, f'krx_all_stocks_{today_file_str}.csv')
        save_dataframe_to_csv(stock_df, stock_csv_file)
        print(f"주식 데이터 백업 완료: {stock_csv_file}")
    
    print("\n2. 다분야 뉴스 데이터 심층 수집 중 (테스트용 분야별 10개)...")
    
    sections_to_crawl = ["100", "101", "102", "104", "105"] 
    crawled_news = []
    
    for section_id in sections_to_crawl:
        print(f"\n[{section_id}] 섹션 URL 탐색 시작...")
        target_urls = fetch_news_urls(section_id=section_id, target_count=10)
        
        print(f"[{section_id}] 총 {len(target_urls)}개의 기사 본문 추출을 시작합니다.")
        for i, url in enumerate(target_urls, 1):
            if i % 20 == 0:
                print(f"  - 진행률: {i}/{len(target_urls)}")
                
            article = parse_news_article(url, section_id)
            if article:
                crawled_news.append(article)
                
            random_delay(1.0, 2.5) 
            
    if crawled_news:
        # [수정된 흐름 1] 원본 뉴스를 JSON으로 '백업'만 합니다.
        raw_news_file = os.path.join(archive_news_dir, f'naver_deep_news_{today_file_str}.json')
        save_news_to_json(crawled_news, raw_news_file)
        print(f"\n원본 뉴스 백업 완료: {raw_news_file}")
        
        # [수정된 흐름 2] 크롤링한 리스트를 파일에서 읽지 않고 바로 DB 원본 테이블에 쏩니다.
        print("\n3. DB에 원본 뉴스 데이터를 일괄 저장합니다...")
        insert_raw_news_to_db(crawled_news)
        
        # [수정된 흐름 3] 크롤링한 리스트(메모리 객체)를 그대로 AI 분석기에 전달합니다.
        print("\n4. AI 뉴스 테마 교차 분석 및 정제를 시작합니다...")
        
        # 추후 보안을 위해 os.getenv를 사용하되, 지금은 기본값으로 키를 유지합니다.
        API_KEY = os.getenv("GEMINI_API_KEY")        
        run_track1_daily_clustering(crawled_news, API_KEY)
        
    print(f"\n--- [종료] 일일 심층 데이터 수집 및 분석이 완료되었습니다 ---")


def main():
    schedule.every().day.at("16:00").do(run_daily_job)
    print("스케줄러 시작. 매일 16:00에 심층 수집이 실행됩니다.")
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    run_daily_job()