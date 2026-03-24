-- 在 Supabase 控制台 → SQL Editor 中执行

create table readings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  birth_date date,
  input_data jsonb,
  ai_report text,
  created_at timestamptz default now()
);

alter table readings enable row level security;

create policy "用户只能读写自己的记录"
  on readings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
