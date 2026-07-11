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
  using (auth.email() = 'rolin9010@foxmail.com');

create policy "管理员可插入消息"
  on support_messages for insert
  with check (auth.email() = 'rolin9010@foxmail.com');

create policy "管理员可更新回复"
  on support_messages for update
  using (auth.email() = 'rolin9010@foxmail.com');

-- readings：管理员可读所有用户的测算记录
create policy "管理员可读所有测算记录"
  on readings for select
  using (auth.email() = 'rolin9010@foxmail.com');

-- user_points：管理员可读写所有用户积分
create policy "管理员可读所有用户积分"
  on user_points for select
  using (auth.email() = 'rolin9010@foxmail.com');

create policy "管理员可更新用户积分"
  on user_points for update
  using (auth.email() = 'rolin9010@foxmail.com');

-- points_records：管理员可读写所有积分流水
create policy "管理员可读所有积分记录"
  on points_records for select
  using (auth.email() = 'rolin9010@foxmail.com');

create policy "管理员可插入积分记录"
  on points_records for insert
  with check (auth.email() = 'rolin9010@foxmail.com');

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
  order_id    text,            -- 支付订单号（微信支付 out_trade_no，仅支付充值使用）
  created_at  timestamptz default now()
);

alter table points_records enable row level security;

create policy "用户只能读写自己的积分记录"
  on points_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create unique index if not exists points_records_order_id_key
  on points_records (order_id)
  where order_id is not null;

-- 支付履约专用：在一个事务内写积分流水并累加余额。
-- 仅服务端 service_role 可调用，避免客户端伪造充值或会员赠分。
create or replace function public.credit_points_once(
  p_user_id uuid,
  p_amount int,
  p_type text,
  p_description text,
  p_order_id text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inserted int;
begin
  if p_amount <= 0 then
    raise exception '积分数量必须大于 0';
  end if;

  if p_type not in ('recharge', 'reward') then
    raise exception '不支持的积分类型: %', p_type;
  end if;

  insert into public.points_records (user_id, type, amount, description, order_id)
  values (p_user_id, p_type, p_amount, p_description, p_order_id)
  on conflict (order_id) where order_id is not null do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  insert into public.user_points (user_id, balance, check_in_streak, last_check_in)
  values (p_user_id, p_amount, 0, null)
  on conflict (user_id) do update
    set balance = public.user_points.balance + excluded.balance,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.credit_points_once(uuid, int, text, text, text)
  from public, anon, authenticated;
grant execute on function public.credit_points_once(uuid, int, text, text, text)
  to service_role;

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

-- ════════════════════════════════════════════════════════════════════════════
-- 会员表（memberships）
-- 在 Supabase 控制台 → SQL Editor 中执行
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists memberships (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan         text not null default 'trial',   -- 'trial'|'monthly'|'quarterly'|'yearly'
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  order_id     text,                             -- 支付订单号（微信支付 out_trade_no）
  amount_fen   int,                              -- 实付金额（分）
  created_at   timestamptz default now()
);

alter table memberships enable row level security;

-- 用户只能读自己的会员记录，写入由服务端 service_role 完成
create policy "用户可读自己的会员记录"
  on memberships for select
  using (auth.uid() = user_id);

-- 管理员可读所有会员记录
create policy "管理员可读所有会员记录"
  on memberships for select
  using (auth.email() = 'rolin9010@foxmail.com');

-- 索引
create index if not exists memberships_user_id_expires_at_idx
  on memberships (user_id, expires_at desc);

create unique index if not exists memberships_order_id_key
  on memberships (order_id)
  where order_id is not null;

-- ── binding_codes 表（微信小程序绑定码）────────────────────────────────────────
-- 如果之前没有建过，在此补充

create table if not exists binding_codes (
  id         uuid default gen_random_uuid() primary key,
  code       text not null unique,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table binding_codes enable row level security;

create policy "用户可读写自己的绑定码"
  on binding_codes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── readings 表补充字段 ─────────────────────────────────────────────────────
-- 添加 is_primary 和 bazi_summary 字段（若已存在会报错，可忽略）

alter table readings
  add column if not exists is_primary   boolean default false,
  add column if not exists bazi_summary jsonb,
  add column if not exists user_email   text;
