import os
import sys
import time
import datetime
import traceback
import schedule

from utils import random_delay, now_kst
from news_crawler import fetch_news_urls, parse_news_article, save_news_to_json
from stock_crawler import collect_stock_snapshot, is_market_hours, SKIPPED
from ai_analyzer import run_track1_daily_clustering
from db_client import insert_raw_news_to_db, insert_track1_report_to_db, get_track1_report_by_date

# 매일 데이터를 수집·분석하는 시각 (이 컴퓨터의 로컬 시간 기준)
DAILY_RUN_TIME = "06:00"
# 장 마감 후 당일 확정 주식 시세를 저장하는 시각 (평일만)
STOCK_CLOSE_RUN_TIME = "16:00"

# 어느 폴더에서 실행하든 항상 프로젝트 루트의 archive_data 폴더 하나에만 백업되도록 고정합니다.
# (예전에는 실행 위치에 따라 루트/archive_data 와 backend/archive_data 두 곳에 나뉘어 저장되었습니다.)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
ARCHIVE_ROOT = os.path.join(PROJECT_ROOT, "archive_data")


def run_daily_job():
    """
    뉴스·주식 수집과 AI 분석을 한 번 실행합니다.
    반환값: 실패한 단계 이름 목록 (빈 목록이면 모두 성공)
    """
    failures = []

    # 1. 현재 시간을 기준으로 날짜 정보 추출
    now = now_kst()
    now_str = now.strftime('%Y-%m-%d %H:%M:%S')
    year_month = now.strftime('%Y-%m')
    today_file_str = now.strftime('%Y%m%d')

    # 2. archive_data 하위에 백업용 news와 stock 폴더 설정
    archive_news_dir = os.path.join(ARCHIVE_ROOT, "news", year_month)
    os.makedirs(archive_news_dir, exist_ok=True)

    print(f"\n--- [시작] {now_str} 일일 데이터 심층 수집 가동 ---")

    print("\n1. 한국거래소(KRX) 전체 주식 데이터 수집 중... (06:00 수집분 = 전 거래일 확정 시세)")
    if collect_stock_snapshot(ARCHIVE_ROOT) is None:
        failures.append("주식 시세 저장")

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
        # 원본 뉴스를 JSON으로 백업합니다.
        raw_news_file = os.path.join(archive_news_dir, f'naver_deep_news_{today_file_str}.json')
        save_news_to_json(crawled_news, raw_news_file)
        print(f"\n원본 뉴스 백업 완료: {raw_news_file}")

        # 크롤링한 리스트를 바로 DB 원본 테이블에 저장합니다.
        print("\n3. DB에 원본 뉴스 데이터를 일괄 저장합니다...")
        if not insert_raw_news_to_db(crawled_news):
            failures.append("원본 뉴스 DB 저장")

        # 크롤링한 리스트(메모리 객체)를 그대로 AI 분석기에 전달합니다.
        print("\n4. AI 뉴스 테마 교차 분석 및 정제를 시작합니다...")
        report_result = run_track1_daily_clustering(crawled_news)

        # 분석 결과가 정상적으로 반환되었다면 DB에 저장합니다.
        if report_result:
            print("\n5. 생성된 트랙 1 리포트를 DB에 저장합니다...")
            report_data = {
                "report_date": now.strftime('%Y-%m-%d'),
                "sectors": report_result["sectors"],
                "cross_correlations": report_result["cross_correlations"]
            }
            if not insert_track1_report_to_db(report_data):
                failures.append("AI 리포트 DB 저장")
        else:
            failures.append("AI 리포트 생성")
    else:
        failures.append("뉴스 수집 (기사 0건)")

    if failures:
        print(f"\n--- [종료] 일부 단계가 실패했습니다: {', '.join(failures)} ---")
    else:
        print(f"\n--- [종료] 일일 심층 데이터 수집 및 분석이 완료되었습니다 ---")
    return failures


def safe_run_daily_job():
    """작업 중 오류가 나도 스케줄러 자체는 멈추지 않도록 감쌉니다."""
    try:
        run_daily_job()
    except Exception:
        print("\n[오류] 일일 작업 중 예외가 발생했습니다. 다음 예정 시각에 다시 시도합니다.")
        traceback.print_exc()


def safe_run_stock_job():
    """장 마감 후 당일 확정 시세만 저장합니다. (주말에는 건너뜀)"""
    if now_kst().weekday() >= 5:
        return
    try:
        print("\n--- [장 마감 수집] 당일 확정 주식 시세를 저장합니다 ---")
        collect_stock_snapshot(ARCHIVE_ROOT)
    except Exception:
        print("\n[오류] 장 마감 주식 수집 중 예외가 발생했습니다.")
        traceback.print_exc()


def catch_up_if_missed():
    """
    컴퓨터가 꺼져 있었거나 프로그램이 늦게 켜져서 오늘 06:00 작업을 놓쳤다면 지금 바로 실행합니다.
    """
    now = now_kst()
    run_hour, run_minute = map(int, DAILY_RUN_TIME.split(":"))
    scheduled_today = now.replace(hour=run_hour, minute=run_minute, second=0, microsecond=0)

    # 주식 시세는 가볍기 때문에 장중만 아니면 시작할 때마다 최신 확정 시세로 갱신합니다.
    if not is_market_hours(now):
        try:
            collect_stock_snapshot(ARCHIVE_ROOT)
        except Exception:
            traceback.print_exc()

    if now < scheduled_today:
        return

    today_str = now.strftime('%Y-%m-%d')
    if get_track1_report_by_date(today_str):
        print(f"오늘({today_str}) 리포트가 이미 있습니다. 다음 {DAILY_RUN_TIME} 작업을 기다립니다.")
        return

    print(f"오늘({today_str}) {DAILY_RUN_TIME} 작업이 아직 실행되지 않아 지금 바로 실행합니다.")
    safe_run_daily_job()


def main():
    schedule.every().day.at(DAILY_RUN_TIME).do(safe_run_daily_job)
    schedule.every().day.at(STOCK_CLOSE_RUN_TIME).do(safe_run_stock_job)
    print(f"스케줄러 시작. 매일 {DAILY_RUN_TIME} 뉴스·주식 수집, 평일 {STOCK_CLOSE_RUN_TIME} 장 마감 주식 수집이 실행됩니다. (종료: Ctrl+C)")

    catch_up_if_missed()

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    # python main.py        → 스케줄러 모드 (매일 06:00 자동 실행, 놓친 작업은 즉시 보충)
    # python main.py --now  → 지금 한 번만 실행하고 종료 (테스트용)
    # python main.py --stock → 주식 시세만 지금 저장하고 종료 (장중에는 건너뜀)
    # 실패하면 종료 코드 1로 끝내서 GitHub Actions에 빨간 X(실패)가 표시되게 합니다.
    if "--stock" in sys.argv:
        if collect_stock_snapshot(ARCHIVE_ROOT) is None:
            sys.exit(1)
    elif "--now" in sys.argv:
        if run_daily_job():
            sys.exit(1)
    else:
        main()
