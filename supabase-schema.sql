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

-- ════════════════════════════════════════════════════════════════════════════
-- 管理员 RLS 策略
-- 将下面 ADMIN_EMAILS 替换为你的管理员邮箱（逗号分隔可加多个）
-- 在 Supabase 控制台 → SQL Editor 中执行
-- ════════════════════════════════════════════════════════════════════════════

-- support_messages：管理员可读写所有消息（含回复）
create policy "管理员可读所有消息"
  on support_messages for select
  using (auth.email() = any(string_to_array(current_setting('app.admin_emails', true), ',')));

create policy "管理员可更新回复"
  on support_messages for update
  using (auth.email() = any(string_to_array(current_setting('app.admin_emails', true), ',')));

-- readings：管理员可读所有用户的测算记录
create policy "管理员可读所有测算记录"
  on readings for select
  using (auth.email() = any(string_to_array(current_setting('app.admin_emails', true), ',')));

-- user_points：管理员可读写所有用户积分
create policy "管理员可读所有用户积分"
  on user_points for select
  using (auth.email() = any(string_to_array(current_setting('app.admin_emails', true), ',')));

create policy "管理员可更新用户积分"
  on user_points for update
  using (auth.email() = any(string_to_array(current_setting('app.admin_emails', true), ',')));

-- points_records：管理员可读写所有积分流水
create policy "管理员可读所有积分记录"
  on points_records for select
  using (auth.email() = any(string_to_array(current_setting('app.admin_emails', true), ',')));

create policy "管理员可插入积分记录"
  on points_records for insert
  with check (auth.email() = any(string_to_array(current_setting('app.admin_emails', true), ',')));

-- ════════════════════════════════════════════════════════════════════════════
-- 积分系统（user_points / points_records / invites）
-- 在 Supabase 控制台 → SQL Editor 中执行以下全部内容
-- ════════════════════════════════════════════════════════════════════════════

-- ── 用户积分余额表 ────────────────────────────────────────────────────────────
create table if not exists user_points (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  balance          int  not null default 0,
  check_in_streak  int  not null default 0,
  last_check_in    date,
  updated_at       timestamptz default now()
);

alter table user_points enable row level security;

create policy "用户只能读写自己的积分行"
  on user_points for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 积分流水表 ────────────────────────────────────────────────────────────────
create table if not exists points_records (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,   -- 'recharge'|'checkin'|'invite'|'consume_ai'|'consume_heban'|'consume_daily'|'reward'
  amount      int  not null,
  description text not null,
  created_at  timestamptz default now()
);

alter table points_records enable row level security;

create policy "用户只能读写自己的积分记录"
  on points_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 邀请关系表 ────────────────────────────────────────────────────────────────
create table if not exists invites (
  id          uuid default gen_random_uuid() primary key,
  inviter_id  uuid not null references auth.users(id) on delete cascade,
  invitee_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (invitee_id)   -- 每个被邀请人只能有一个邀请人
);

alter table invites enable row level security;

-- 只允许读自己相关的邀请记录
create policy "用户可查自己的邀请记录"
  on invites for select
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- ── 新用户注册触发器：初始化积分 + 处理邀请奖励 ─────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_invite_points int := 3;   -- 邀请双方各得积分数
begin
  -- 1. 初始化新用户积分行（赠送 5 积分）
  insert into public.user_points (user_id, balance, check_in_streak, last_check_in)
  values (new.id, 5, 0, null)
  on conflict (user_id) do nothing;

  insert into public.points_records (user_id, type, amount, description)
  values (new.id, 'reward', 5, '新用户赠送');

  -- 2. 处理邀请奖励
  -- 从 user_metadata 中取 referrer_id（注册时前端写入）
  v_referrer_id := (new.raw_user_meta_data->>'referrer_id')::uuid;

  if v_referrer_id is not null
    and v_referrer_id <> new.id
    -- 确认邀请人账号存在
    and exists (select 1 from auth.users where id = v_referrer_id)
    -- 防止重复邀请（invitee 唯一约束）
    and not exists (select 1 from public.invites where invitee_id = new.id)
  then
    -- 写入邀请关系
    insert into public.invites (inviter_id, invitee_id)
    values (v_referrer_id, new.id);

    -- 给邀请人加积分
    insert into public.user_points (user_id, balance)
    values (v_referrer_id, v_invite_points)
    on conflict (user_id) do update
      set balance    = public.user_points.balance + v_invite_points,
          updated_at = now();

    insert into public.points_records (user_id, type, amount, description)
    values (v_referrer_id, 'invite', v_invite_points, '邀请好友注册奖励');

    -- 给被邀请人（新用户）加积分
    update public.user_points
    set balance    = balance + v_invite_points,
        updated_at = now()
    where user_id = new.id;

    insert into public.points_records (user_id, type, amount, description)
    values (new.id, 'invite', v_invite_points, '通过邀请链接注册奖励');
  end if;

  return new;
end;
$$;

-- 挂载触发器（若已存在先删除）
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════════
-- 管理员已读标记字段（在 Supabase SQL Editor 执行）
-- 管理员打开某个 session 时批量更新该 session 所有消息的 admin_read_at
-- ════════════════════════════════════════════════════════════════════════════

-- 给 support_messages 表加已读时间字段（若已存在会报错，可忽略）
alter table support_messages
  add column if not exists admin_read_at timestamptz;
