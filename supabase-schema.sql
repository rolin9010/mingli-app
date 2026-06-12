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

-- ── 客服咨询消息表 ────────────────────────────────────────────────────────────
-- 用户点击"立即咨询客服"后发送的消息存储于此，后台通过 Supabase Dashboard 查阅

create table support_messages (
  id uuid default gen_random_uuid() primary key,
  session_id text not null,             -- 前端生成的会话 ID
  user_id text,                         -- auth user_id（未登录则为 'anonymous'）
  content text not null,                -- 用户消息内容
  context_info text,                    -- 来源报告描述，例如 "单人报告 - 张三"
  created_at timestamptz default now()
);

-- 仅管理员（service_role）可读；用户只能插入自己的消息，无法读取他人消息
alter table support_messages enable row level security;

create policy "任何人可插入咨询消息"
  on support_messages for insert
  with check (true);

-- 注意：查询权限仅对 service_role 开放（Supabase Dashboard 内置 service_role）
-- 若需后台管理员账号查看，可在 Dashboard → Table Editor → support_messages 直接查阅
