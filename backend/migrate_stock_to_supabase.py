"""
[1회용] 지금까지 로컬에 저장된 주식 CSV를 Supabase(stock_daily, stock_prices)로 옮깁니다.

사용법 (backend 폴더에서):
    python migrate_stock_to_supabase.py

- archive_data/stock/**/krx_all_stocks_YYYYMMDD.csv  (현재 방식)
- backend/archive_data/**/krx_all_stocks_YYYYMMDD.csv (예전 방식, 수집 시각 정보 없음)
을 모두 찾아 날짜별로 올립니다. 같은 날짜가 이미 DB에 있으면 덮어씁니다.
여러 번 실행해도 안전합니다.
"""
import os
import csv
import glob
import json
import datetime

from stock_crawler import fetch_index_history
from stock_service import parse_stock_records, build_daily_record, build_price_rows
from db_client import upsert_stock_daily, upsert_stock_prices

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ARCHIVE_ROOT = os.path.join(os.path.dirname(BACKEND_DIR), "archive_data")

CURRENT_PATTERN = os.path.join(ARCHIVE_ROOT, "stock", "*", "krx_all_stocks_*.csv")
LEGACY_PATTERNS = [
    os.path.join(BACKEND_DIR, "archive_data", "stock", "*", "krx_all_stocks_*.csv"),
    os.path.join(BACKEND_DIR, "archive_data", "*", "krx_all_stocks_*.csv"),
]


def date_from_filename(path):
    suffix = os.path.basename(path).replace("krx_all_stocks_", "").replace(".csv", "")
    if len(suffix) != 8 or not suffix.isdigit():
        return None
    return f"{suffix[:4]}-{suffix[4:6]}-{suffix[6:8]}"


def find_csv_files():
    """{거래일: (경로, 예전 방식 여부)} — 같은 날짜는 현재 방식 파일 우선"""
    files = {}
    for pattern in LEGACY_PATTERNS:
        for path in glob.glob(pattern):
            date = date_from_filename(path)
            if date:
                files[date] = (path, True)
    for path in glob.glob(CURRENT_PATTERN):
        date = date_from_filename(path)
        if date:
            files[date] = (path, False)
    return dict(sorted(files.items()))


def load_snapshot_meta(csv_path):
    """같은 폴더의 krx_snapshot_YYYYMMDD.json (있으면) 읽기"""
    suffix = os.path.basename(csv_path).replace("krx_all_stocks_", "").replace(".csv", "")
    meta_path = os.path.join(os.path.dirname(csv_path), f"krx_snapshot_{suffix}.json")
    if os.path.exists(meta_path):
        with open(meta_path, encoding='utf-8') as f:
            return json.load(f)
    return None


def main():
    files = find_csv_files()
    if not files:
        print("옮길 주식 CSV 파일이 없습니다.")
        return

    print(f"총 {len(files)}일치 주식 데이터를 Supabase로 옮깁니다: {', '.join(files)}")

    # 스냅샷 정보가 없는 예전 파일용으로 지수 기록을 한 번만 가져옵니다. (최근 약 1년)
    print("지수 기록(코스피·코스닥)을 가져오는 중...")
    fallback_index_history = fetch_index_history(days=400)

    success = 0
    for trade_date, (path, is_legacy) in files.items():
        print(f"\n[{trade_date}] {path}")
        with open(path, encoding='utf-8-sig', newline='') as f:
            rows = parse_stock_records(csv.DictReader(f))
        if not rows:
            print("  - 종목 데이터가 없어 건너뜁니다.")
            continue

        meta = load_snapshot_meta(path)
        if meta:
            collected_at = meta.get("collected_at")
            index_history = meta.get("indices") or fallback_index_history
        else:
            # 수집 시각 기록이 없으면 파일 수정 시각을 사용합니다.
            collected_at = datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M:%S')
            index_history = fallback_index_history

        ok_daily = upsert_stock_daily(build_daily_record(trade_date, collected_at, rows, index_history, is_legacy))
        ok_prices = upsert_stock_prices(build_price_rows(trade_date, rows))
        if ok_daily and ok_prices:
            success += 1

    print(f"\n완료: {success}/{len(files)}일 업로드 성공")


if __name__ == "__main__":
    main()
