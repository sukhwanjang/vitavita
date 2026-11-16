-- 공지 띠(흐르는 빨간 글씨) 테이블 — Supabase SQL Editor에서 1회 실행
-- 현황판 상단에 계속 흘러가는 공지 문구를 저장한다. 모든 현황판 화면이 같은 공지를 본다.

create table if not exists notices (
  id bigserial primary key,
  message text not null,
  created_by text,                    -- 적은 사람 이름 (현황판에 저장된 이름)
  created_at timestamptz not null default now()
);

alter table notices enable row level security;

drop policy if exists "notices_all" on notices;
create policy "notices_all" on notices
  for all using (true) with check (true);

-- 실시간 전달 (이 줄이 없으면 1분 주기로만 바뀐 공지를 받음)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notices'
  ) then
    alter publication supabase_realtime add table notices;
  end if;
end $$;
