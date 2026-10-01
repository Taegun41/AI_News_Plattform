"""
코스피·코스닥 지수 일별 종가를 가져오는 모듈.

1순위: 네이버 증권 차트 데이터 (fchart.stock.naver.com) — 당일 종가까지 빠르게 반영됨
2순위: FinanceDataReader — 네이버가 실패할 때만 사용
       (FinanceDataReader의 지수 데이터는 며칠씩 늦게 갱신되는 경우가 있어 2순위로 둡니다)

반환 형식: {"KS11": [{"date": "2026-10-01", "close": 6971.35}, ...], "KQ11": [...]}  (오래된 순)
"""
import re
import datetime

import requests

from utils import now_kst

# 내부 코드 → 네이버 차트 심볼
NAVER_SYMBOLS = {"KS11": "KOSPI", "KQ11": "KOSDAQ"}
NAVER_CHART_URL = "https://fchart.stock.naver.com/sise.nhn"
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://finance.naver.com/",
}

# <item data="20261001|시가|고가|저가|종가|거래량" />
_ITEM_PATTERN = re.compile(r'data="(\d{8})\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|')


def _fetch_naver(code, count):
    response = requests.get(
        NAVER_CHART_URL,
        params={"symbol": NAVER_SYMBOLS[code], "timeframe": "day", "count": count, "requestType": 0},
        headers=REQUEST_HEADERS,
        timeout=10,
    )
    response.raise_for_status()
    history = []
    for ymd, _open, _high, _low, close in _ITEM_PATTERN.findall(response.text):
        try:
            close_value = float(close)
        except ValueError:
            continue
        history.append({"date": f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}", "close": round(close_value, 2)})
    history.sort(key=lambda h: h["date"])
    return history


def _fetch_fdr(code, days):
    import FinanceDataReader as fdr
    start = (now_kst() - datetime.timedelta(days=days)).strftime('%Y-%m-%d')
    df = fdr.DataReader(code, start)
    return [
        {"date": idx.strftime('%Y-%m-%d'), "close": round(float(row['Close']), 2)}
        for idx, row in df.iterrows()
        if row['Close'] == row['Close']  # NaN 제외
    ]


def fetch_index_history(days=120):
    """코스피·코스닥 지수의 최근 일별 종가. 출처별로 시도하고 실패한 지수는 빈 목록."""
    # 달력 일수 → 대략적인 거래일 수 (+여유)
    count = max(10, int(days * 5 / 7) + 5)
    result = {}
    for code in NAVER_SYMBOLS:
        history = []
        try:
            history = _fetch_naver(code, count)
        except Exception as e:
            print(f"[{code}] 네이버 지수 조회 실패, FinanceDataReader로 재시도합니다: {e}")
        if not history:
            try:
                history = _fetch_fdr(code, days)
            except Exception as e:
                print(f"[{code}] FinanceDataReader 지수 조회 실패: {e}")
        result[code] = history
    return result
