import os
import json
import datetime
import FinanceDataReader as fdr

from utils import now_kst
from index_source import fetch_index_history
from stock_service import parse_stock_records, build_daily_record, build_price_rows

# 지수 코드 (FinanceDataReader 기준)
INDEX_CODES = {
    "KS11": "코스피",
    "KQ11": "코스닥",
}

# 장중 데이터는 계속 바뀌므로 이 시간대에는 시세를 저장하지 않습니다. (평일 09:00 ~ 15:40)
MARKET_OPEN = datetime.time(9, 0)
MARKET_FINAL = datetime.time(15, 40)  # 15:30 장 마감 후 종가가 확정되는 여유 시간 포함


def is_market_hours(now=None):
    """평일 장중(09:00~15:40)인지 확인합니다. (공휴일은 고려하지 않습니다)"""
    now = now or now_kst()
    return now.weekday() < 5 and MARKET_OPEN <= now.time() < MARKET_FINAL


def fetch_all_stock_data():
    """
    FinanceDataReader를 활용해 한국 거래소(KRX) 전체 종목의 시세를 가져옵니다.
    코스피, 코스닥, 코넥스 시장의 모든 상장 종목이 포함됩니다.
    (장 마감 후에는 당일 종가, 다음 날 장 시작 전에는 전 거래일 종가가 들어옵니다)
    """
    try:
        df = fdr.StockListing('KRX')
        return df
    except Exception as e:
        print(f"주식 데이터 수집 중 오류 발생: {e}")
        return None


def weekday_trade_date(now):
    """평일 기준 추정 거래일: 장 마감 후 평일이면 오늘, 아니면 직전 평일 (공휴일은 모름)"""
    day = now.date()
    if not (day.weekday() < 5 and now.time() >= MARKET_FINAL):
        day -= datetime.timedelta(days=1)
        while day.weekday() >= 5:
            day -= datetime.timedelta(days=1)
    return day.strftime('%Y-%m-%d')


# 지수 데이터의 마지막 날짜가 평일 추정일보다 이만큼 이상 오래되면, 지수 출처가 멈춘 것으로 보고 믿지 않습니다.
# (추석·설 연휴는 최대 5일 정도라 그보다 여유 있게 잡음)
INDEX_STALE_DAYS = 6


def determine_trade_date(index_history, now=None):
    """
    지금 수집한 시세가 '어느 거래일의 확정 시세'인지 계산합니다.
    - 지수 데이터의 마지막 날짜를 마지막 거래일로 봅니다. (주말·공휴일 자동 반영)
    - 단, 지수 출처가 갱신을 멈춰 날짜가 너무 오래됐거나 지수를 못 가져왔으면 평일 기준으로 추정합니다.
      (예전에 지수 출처가 9/17에서 멈춰 10/1 시세가 9/17로 저장된 문제 방지)
    """
    now = now or now_kst()
    today = now.strftime('%Y-%m-%d')
    estimate = weekday_trade_date(now)

    dates = [item["date"] for item in index_history.get("KS11", []) if item["date"] <= today]
    if dates:
        last_date = max(dates)
        # 장 마감 전(이른 아침)에 오늘 날짜 행이 섞여 들어와도 오늘은 아직 확정되지 않았으므로 제외
        if last_date == today and now.time() < MARKET_FINAL:
            earlier = [d for d in dates if d < today]
            last_date = max(earlier) if earlier else estimate

        gap = (datetime.date.fromisoformat(estimate) - datetime.date.fromisoformat(last_date)).days
        if gap < INDEX_STALE_DAYS:
            return last_date
        print(f"[주식] 지수 데이터가 {last_date}에서 멈춰 있어 믿을 수 없습니다. 평일 기준 {estimate}로 저장합니다.")

    return estimate


def save_dataframe_to_csv(df, file_path):
    """
    Pandas 데이터프레임을 CSV 파일로 저장합니다.
    """
    if df is None or df.empty:
        print("저장할 주식 데이터가 없습니다.")
        return

    # utf-8-sig: 윈도우 엑셀 환경에서 한글이 깨지는 것을 방지합니다.
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    print(f"총 {len(df)}개 종목의 데이터가 성공적으로 저장되었습니다: {file_path}")


# 장중이라 일부러 저장을 건너뛴 경우의 반환값 (실패와 구분)
SKIPPED = "skipped"


def collect_stock_snapshot(archive_root, save_to_db=True):
    """
    전 종목 시세 + 지수 데이터를 '거래일' 기준으로 저장합니다.
      1) Supabase  stock_daily  : 거래일 요약 (지수, 상한가/하한가/급등/거래량 목록) ← 주식 페이지가 읽는 곳
      2) Supabase  stock_prices : 전 종목 시세 (나중에 다른 분석용)
      3) 로컬 백업 archive_data/stock/2026-10/krx_all_stocks_20261001.csv (+ krx_snapshot_20261001.json)
    같은 거래일은 덮어쓰므로, 06:00(전날 확정분)과 16:00(당일 확정분) 수집이 섞이지 않습니다.
    장중에는 데이터가 확정되지 않았으므로 저장하지 않습니다.
    """
    now = now_kst()
    if is_market_hours(now):
        print("현재 장중이라 시세가 확정되지 않았습니다. 주식 데이터 저장을 건너뜁니다. (장 마감 후 16:00에 자동 수집)")
        return SKIPPED

    stock_df = fetch_all_stock_data()
    if stock_df is None or stock_df.empty:
        print("[주식] 전 종목 시세를 가져오지 못해 저장하지 못했습니다.")
        return None

    index_history = fetch_index_history()
    trade_date = determine_trade_date(index_history, now)
    trade_dt = datetime.datetime.strptime(trade_date, '%Y-%m-%d')
    collected_at = now.strftime('%Y-%m-%d %H:%M:%S')

    # --- 1·2) Supabase 저장 ---
    if save_to_db:
        from db_client import upsert_stock_daily, upsert_stock_prices
        rows = parse_stock_records(stock_df.to_dict('records'))
        print(f"[주식] 종목 {len(rows)}개, 지수 마지막 날짜: "
              f"코스피 {(index_history.get('KS11') or [{}])[-1].get('date', '없음')}, "
              f"코스닥 {(index_history.get('KQ11') or [{}])[-1].get('date', '없음')}")
        if not rows:
            print("[주식] 코스피·코스닥 종목이 0개라 저장하지 않습니다.")
            return None
        ok_daily = upsert_stock_daily(build_daily_record(trade_date, collected_at, rows, index_history))
        ok_prices = upsert_stock_prices(build_price_rows(trade_date, rows))
        if not (ok_daily and ok_prices):
            print("[주식] Supabase 저장에 실패했습니다. 위의 [DB 저장 실패] 메시지를 확인하세요.")
            return None

    # --- 3) 로컬 백업 (클라우드에서는 실행이 끝나면 사라지지만 오류 없이 넘어갑니다) ---
    try:
        stock_dir = os.path.join(archive_root, "stock", trade_dt.strftime('%Y-%m'))
        os.makedirs(stock_dir, exist_ok=True)
        file_suffix = trade_dt.strftime('%Y%m%d')

        csv_path = os.path.join(stock_dir, f'krx_all_stocks_{file_suffix}.csv')
        save_dataframe_to_csv(stock_df, csv_path)

        snapshot_path = os.path.join(stock_dir, f'krx_snapshot_{file_suffix}.json')
        with open(snapshot_path, 'w', encoding='utf-8') as f:
            json.dump({
                "trade_date": trade_date,
                "collected_at": collected_at,
                "indices": index_history,
            }, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[주식] 로컬 백업 저장 실패 (DB 저장에는 영향 없음): {e}")

    print(f"주식 데이터 저장 완료 (기준 거래일: {trade_date})")
    return trade_date


if __name__ == "__main__":
    print("KRX 전체 종목 + 지수 데이터 단독 테스트를 시작합니다...")
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    collect_stock_snapshot(os.path.join(os.path.dirname(backend_dir), "archive_data"))
