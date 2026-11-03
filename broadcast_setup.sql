-- 층간 방송(확성기) 테이블 — Supabase SQL Editor에서 1회 실행
-- 2층 사무실 ↔ 1층 작업장 사이에 짧은 말을 보내면 상대 현황판이 소리내어 읽어줌

create table if not exists broadcasts (
  id bigserial primary key,
  message text not null,
  sender text,                        -- 보낸 사람 이름 (현황판에 저장된 이름)
  client_id text,                     -- 보낸 브라우저 식별자 (내가 보낸 건 내 화면에서 안 울리게)
  acked_by text,                      -- 확인 누른 사람
  acked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table broadcasts enable row level security;

drop policy if exists "broadcasts_all" on broadcasts;
create policy "broadcasts_all" on broadcasts
  for all using (true) with check (true);

-- 실시간 전달 (이 줄이 없으면 10초 주기로만 받음)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'broadcasts'
  ) then
    alter publication supabase_realtime add table broadcasts;
  end if;
end $$;
