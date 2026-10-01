"""
주식 데이터 가공 모듈.

- 수집할 때: KRX 전 종목 시세 → 상한가 / 하한가 / 15% 이상 상승 / 거래량 1000만 이상 목록을 계산해
  Supabase에 저장할 형태(build_daily_record, build_price_rows)로 만듭니다.
- 조회할 때: Supabase에 저장된 거래일 요약을 주식 페이지용 응답(get_stock_overview)으로 만듭니다.
"""
import time
import math
import datetime
import threading

from utils import now_kst

# 화면에 보여줄 시장 (코넥스는 가격제한폭이 ±15%로 달라 제외)
TARGET_MARKETS = {"KOSPI", "KOSDAQ", "KOSDAQ GLOBAL"}

SURGE_RATIO = 15.0             # 급등 기준 (%)
VOLUME_THRESHOLD = 10_000_000  # 거래량 기준 (주)
PRICE_LIMIT_RATE = 0.30        # 코스피·코스닥 가격제한폭 ±30%

INDEX_NAMES = {"KS11": "코스피", "KQ11": "코스닥"}
INDEX_HISTORY_POINTS = 60      # 지수 미니 차트에 쓰는 최근 거래일 수
LIVE_INDEX_CACHE_SECONDS = 300 # 실시간 지수 조회 결과를 5분간 재사용

MARKET_OPEN = datetime.time(9, 0)
MARKET_FINAL = datetime.time(15, 40)


# ----------------------------- 가격제한폭 계산 -----------------------------

def tick_size(price):
    """KRX 호가가격단위 (2023년 이후 코스피·코스닥 공통)"""
    if price < 2_000:
        return 1
    if price < 5_000:
        return 5
    if price < 20_000:
        return 10
    if price < 50_000:
        return 50
    if price < 200_000:
        return 100
    if price < 500_000:
        return 500
    return 1_000


def upper_limit_price(prev_close):
    """상한가: 전일 종가 × 1.3 을 호가단위로 내림"""
    raw = round(prev_close * (1 + PRICE_LIMIT_RATE), 6)
    tick = tick_size(raw)
    return math.floor(raw / tick) * tick


def lower_limit_price(prev_close):
    """하한가: 전일 종가 × 0.7 을 호가단위로 올림"""
    raw = round(prev_close * (1 - PRICE_LIMIT_RATE), 6)
    tick = tick_size(raw)
    return math.ceil(raw / tick) * tick


# ----------------------------- 수집 데이터 가공 -----------------------------

def _to_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return 0.0 if number != number else number  # NaN → 0


def parse_stock_records(records):
    """
    KRX 원본 레코드(FinanceDataReader DataFrame의 to_dict('records') 또는 CSV 행)를
    화면·DB에 필요한 값만 가진 종목 목록으로 변환합니다.
    """
    rows = []
    for raw in records:
        market = str(raw.get('Market') or '')
        if market not in TARGET_MARKETS:
            continue

        close = _to_float(raw.get('Close'))
        change = _to_float(raw.get('Changes'))
        prev_close = close - change
        if close <= 0 or prev_close <= 0:
            continue

        code = str(raw.get('Code') or '').strip()
        if code.isdigit():
            code = code.zfill(6)  # CSV에서 앞자리 0이 사라진 경우 복원 (예: 5930 → 005930)

        rows.append({
            "code": code,
            "name": str(raw.get('Name') or ''),
            "market": "KOSDAQ" if market.startswith("KOSDAQ") else market,
            "close": int(close),
            "change": int(change),
            "change_ratio": round(_to_float(raw.get('ChagesRatio')), 2),
            "volume": int(_to_float(raw.get('Volume'))),
            "amount": int(_to_float(raw.get('Amount'))),
            "marcap": int(_to_float(raw.get('Marcap'))),
            "prev_close": prev_close,
        })
    return rows


def _sort(items, key):
    return sorted(items, key=lambda x: x[key], reverse=True)


def _public(item):
    """내부 계산용 필드(prev_close)를 제거합니다."""
    return {k: v for k, v in item.items() if k != "prev_close"}


def compute_feature_lists(rows):
    """상한가 / 하한가 / 급등 / 거래량 목록을 계산합니다."""
    # 종가가 계산한 상한가/하한가와 정확히 같은 종목만 포함합니다.
    # (신규 상장일처럼 ±30% 제한이 없는 종목은 범위를 벗어나므로 자동으로 제외되고, 급등 목록에만 나옵니다)
    upper = [r for r in rows if r["close"] == upper_limit_price(r["prev_close"])]
    lower = [r for r in rows if r["close"] == lower_limit_price(r["prev_close"])]
    surge = [r for r in rows if r["change_ratio"] >= SURGE_RATIO]
    volume = [r for r in rows if r["volume"] >= VOLUME_THRESHOLD]

    return {
        "upper_limit": [_public(r) for r in _sort(upper, "amount")],
        "lower_limit": [_public(r) for r in _sort(lower, "amount")],
        "surge": [_public(r) for r in _sort(surge, "change_ratio")],
        "high_volume": [_public(r) for r in _sort(volume, "volume")],
        "total_stocks": len(rows),
    }


def slice_index_history(index_history, trade_date):
    """지수 기록에서 해당 거래일까지의 최근 기록만 잘라냅니다."""
    return {
        code: [h for h in (index_history or {}).get(code, []) if h["date"] <= trade_date][-INDEX_HISTORY_POINTS:]
        for code in INDEX_NAMES
    }


def build_daily_record(trade_date, collected_at, rows, index_history, is_legacy=False):
    """stock_daily 테이블에 저장할 한 줄(거래일 요약)을 만듭니다."""
    return {
        "trade_date": trade_date,
        "collected_at": collected_at,
        "is_legacy": is_legacy,
        "criteria": {"surge_ratio": SURGE_RATIO, "volume": VOLUME_THRESHOLD},
        "indices": slice_index_history(index_history, trade_date),
        **compute_feature_lists(rows),
    }


def build_price_rows(trade_date, rows):
    """stock_prices 테이블에 저장할 전 종목 시세 목록을 만듭니다."""
    return [{"trade_date": trade_date, **_public(r)} for r in rows]


# ----------------------------- 지수 -----------------------------

_live_index_cache = {"saved_at": 0.0, "data": None}
_live_index_lock = threading.Lock()


def _fetch_live_index_history():
    """지수를 실시간 조회합니다. (5분간 결과 재사용, 실패하면 None)"""
    with _live_index_lock:
        if _live_index_cache["data"] and time.time() - _live_index_cache["saved_at"] < LIVE_INDEX_CACHE_SECONDS:
            return _live_index_cache["data"]
        try:
            from index_source import fetch_index_history
            data = fetch_index_history(days=120)
            if not all(data.get(code) for code in INDEX_NAMES):
                return None
            _live_index_cache.update(saved_at=time.time(), data=data)
            return data
        except Exception as e:
            print(f"[주식] 실시간 지수 조회 실패, 저장된 데이터로 대체합니다: {e}")
            return None


def build_index_cards(saved_indices, trade_date, is_latest):
    """
    코스피·코스닥 카드 데이터 (현재값, 전일 대비, 최근 추이)
    - 최신 데이터를 볼 때: 실시간 조회값(장중이면 '장중')을 우선 사용
    - 과거 날짜를 볼 때: DB에 저장된 그 거래일까지의 기록 사용
    """
    live = _fetch_live_index_history() if is_latest else None
    now = now_kst()
    today = now.strftime('%Y-%m-%d')
    market_open_now = now.weekday() < 5 and MARKET_OPEN <= now.time() < MARKET_FINAL

    cards = []
    for code, name in INDEX_NAMES.items():
        live_history = (live or {}).get(code) or []
        saved_history = (saved_indices or {}).get(code) or []
        # 두 출처 중 더 최근 날짜까지 있는 쪽을 사용합니다. (한쪽 출처가 갱신을 멈춘 경우 대비)
        live_last = live_history[-1]["date"] if live_history else ""
        saved_last = saved_history[-1]["date"] if saved_history else ""
        history = live_history if live_last >= saved_last else saved_history
        if not is_latest:
            history = [h for h in history if h["date"] <= trade_date]
        history = history[-INDEX_HISTORY_POINTS:]
        if len(history) < 2:
            continue
        last, prev = history[-1], history[-2]
        change = last["close"] - prev["close"]
        cards.append({
            "code": code,
            "name": name,
            "date": last["date"],
            "close": last["close"],
            "change": round(change, 2),
            "change_ratio": round(change / prev["close"] * 100, 2) if prev["close"] else 0,
            "status": "장중" if (history is live_history and last["date"] == today and market_open_now) else "장마감",
            "history": history,
        })
    return cards


# ----------------------------- 조회 (API용) -----------------------------

def is_intraday_snapshot(trade_date, collected_at):
    """장중에 수집되어 확정되지 않은 데이터인지 확인합니다."""
    try:
        collected = datetime.datetime.strptime(str(collected_at)[:19], '%Y-%m-%d %H:%M:%S')
    except (TypeError, ValueError):
        return False
    return (
        collected.strftime('%Y-%m-%d') == trade_date
        and collected.weekday() < 5
        and MARKET_OPEN <= collected.time() < MARKET_FINAL
    )


def get_stock_overview(date=None):
    """
    주식 페이지에 필요한 모든 데이터를 Supabase에서 읽어 만듭니다.
    date(YYYY-MM-DD)를 주면 그 거래일, 없으면 가장 최근 거래일. 해당 데이터가 없으면 None.
    """
    from db_client import get_stock_daily, get_stock_dates

    record = get_stock_daily(date)
    if not record:
        return None

    available_dates = [str(d)[:10] for d in get_stock_dates()]
    trade_date = str(record["trade_date"])[:10]
    is_latest = not available_dates or trade_date == available_dates[-1]

    return {
        "trade_date": trade_date,
        "collected_at": record.get("collected_at") or "",
        "is_today": trade_date == now_kst().strftime('%Y-%m-%d'),
        "is_latest": is_latest,
        "is_legacy": bool(record.get("is_legacy")),
        "is_intraday": is_intraday_snapshot(trade_date, record.get("collected_at")),
        "available_dates": available_dates,
        "criteria": record.get("criteria") or {"surge_ratio": SURGE_RATIO, "volume": VOLUME_THRESHOLD},
        "indices": build_index_cards(record.get("indices"), trade_date, is_latest),
        "upper_limit": record.get("upper_limit") or [],
        "lower_limit": record.get("lower_limit") or [],
        "surge": record.get("surge") or [],
        "high_volume": record.get("high_volume") or [],
        "total_stocks": record.get("total_stocks") or 0,
    }


def get_available_dates():
    """주식 데이터가 저장된 거래일 목록 (오래된 순)"""
    from db_client import get_stock_dates
    return [str(d)[:10] for d in get_stock_dates()]
