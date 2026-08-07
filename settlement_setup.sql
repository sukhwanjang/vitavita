-- 월말 정산 체크보드 테이블 (Supabase SQL Editor에서 1회 실행)
create table if not exists settlement_items (
  id uuid primary key default gen_random_uuid(),
  month text not null,                       -- 'YYYY-MM'
  item_type text not null default '미수',    -- 미수 | 미지급
  company text not null,
  amount numeric not null default 0,
  biz_no text,
  statement_sent boolean not null default false,   -- 명세표 발송
  statement_by text,
  statement_at timestamptz,
  invoice_status text not null default '미발행',   -- 미발행 | 발행요청 | 발행완료
  invoice_by text,
  invoice_at timestamptz,
  paid boolean not null default false,             -- 입금 확인
  paid_by text,
  paid_at timestamptz,
  memo text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, item_type, company)
);

alter table settlement_items enable row level security;

drop policy if exists "settlement_all" on settlement_items;
create policy "settlement_all" on settlement_items
  for all using (true) with check (true);

-- 블랙리스트 (못 받는 업체 — 업체명 기준, 모든 달에 공통 적용)
create table if not exists settlement_blacklist (
  company text primary key,
  added_by text,
  created_at timestamptz not null default now()
);

alter table settlement_blacklist enable row level security;

drop policy if exists "settlement_blacklist_all" on settlement_blacklist;
create policy "settlement_blacklist_all" on settlement_blacklist
  for all using (true) with check (true);

-- 카드 결제 표시 (2026-08 추가)
alter table settlement_items add column if not exists card_paid boolean not null default false;

-- 업체 정보 (업체명 기준 — 매달 유지되는 메모, 2026-08 추가)
create table if not exists settlement_company_info (
  company text primary key,
  info text not null default '',
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table settlement_company_info enable row level security;

drop policy if exists "settlement_company_info_all" on settlement_company_info;
create policy "settlement_company_info_all" on settlement_company_info
  for all using (true) with check (true);
