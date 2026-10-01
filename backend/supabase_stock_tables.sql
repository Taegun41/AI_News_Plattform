-- =====================================================================
-- 주식 데이터용 테이블 (Supabase → SQL Editor → New query 에 붙여넣고 Run)
-- 여러 번 실행해도 안전합니다. (이미 있으면 건너뜀)
-- =====================================================================

-- 1) 거래일별 요약: 주식 페이지가 읽는 테이블
--    하루 1줄. 지수 기록과 상한가/하한가/급등/거래량 목록을 JSON으로 저장합니다.
create table if not exists public.stock_daily (
  trade_date    date primary key,           -- 기준 거래일
  collected_at  text,                       -- 수집 시각 (한국 시간, 'YYYY-MM-DD HH:MM:SS')
  is_legacy     boolean not null default false, -- 예전 방식(수집 시각 불명확)으로 저장된 데이터
  criteria      jsonb,                      -- {"surge_ratio": 15, "volume": 10000000}
  indices       jsonb,                      -- {"KS11": [{"date","close"}...], "KQ11": [...]}
  upper_limit   jsonb not null default '[]'::jsonb,  -- 상한가 종목
  lower_limit   jsonb not null default '[]'::jsonb,  -- 하한가 종목
  surge         jsonb not null default '[]'::jsonb,  -- 15% 이상 상승 종목
  high_volume   jsonb not null default '[]'::jsonb,  -- 거래량 1000만 이상 종목
  total_stocks  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- 2) 전 종목 시세: 하루 약 2,800줄. 지금 화면에서는 쓰지 않고, 나중에 기준을 바꾸거나 분석할 때 사용합니다.
create table if not exists public.stock_prices (
  trade_date    date   not null,
  code          text   not null,            -- 종목코드 (예: 005930)
  name          text   not null,
  market        text   not null,            -- KOSPI / KOSDAQ
  close         bigint not null,            -- 종가
  change        bigint not null,            -- 전일 대비
  change_ratio  numeric(8, 2) not null,     -- 등락률 (%)
  volume        bigint not null,            -- 거래량
  amount        bigint not null,            -- 거래대금 (원)
  marcap        bigint not null,            -- 시가총액 (원)
  primary key (trade_date, code)
);

create index if not exists stock_prices_code_idx on public.stock_prices (code, trade_date desc);

-- 3) 보안(RLS): 누구나 '읽기'만 가능, 쓰기는 백엔드의 service_role(secret) 키로만 가능
alter table public.stock_daily  enable row level security;
alter table public.stock_prices enable row level security;

drop policy if exists "stock_daily public read"  on public.stock_daily;
drop policy if exists "stock_prices public read" on public.stock_prices;

create policy "stock_daily public read"  on public.stock_daily  for select using (true);
create policy "stock_prices public read" on public.stock_prices for select using (true);
