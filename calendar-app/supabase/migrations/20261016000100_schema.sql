-- =====================================================================
-- 第一階段：資料表結構
-- 個人專案行事曆暨工作期限提醒系統（多使用者，每位客戶資料獨立）
--
-- 設計原則：
--  * 每張客戶資料表都有 user_id，預設值為 auth.uid()，並由 RLS 驗證
--    （前端傳入的 user_id 不是安全依據，見 20261016000200_rls.sql）
--  * 跨表參照一律使用 (id, user_id) 複合外鍵，避免 A 使用者的資料
--    參照到 B 使用者的專案或事件（外鍵檢查不受 RLS 限制，必須在結構上防堵）
--  * 時間欄位一律 timestamptz；以 Asia/Taipei 判斷「哪一天」
-- =====================================================================

-- ---------- 列舉型別 ----------
create type public.event_type as enum (
  'meeting',          -- 會議
  'site_visit',       -- 現場會勘
  'document_reply',   -- 公文回文
  'presentation',     -- 簡報繳交
  'drawing_revision', -- 修正圖說
  'other'             -- 其他工作
);

create type public.event_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.event_status as enum ('todo', 'in_progress', 'done', 'cancelled');

-- 期限模板的基準事件
create type public.deadline_base_kind as enum (
  'agency_notice',  -- 機關通知日
  'review_meeting', -- 審查會議
  'site_visit'      -- 會勘
);

create type public.holiday_kind as enum (
  'holiday', -- 放假（國定假日、補假、人工設定停止辦公）
  'workday'  -- 上班（補行上班日、人工設定特殊辦公日）
);

create type public.notification_job_status as enum (
  'pending', 'processing', 'sent', 'failed', 'cancelled'
);

-- ---------- 共用：updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- profiles：個人設定 ----------
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  timezone text not null default 'Asia/Taipei' check (timezone = 'Asia/Taipei'),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- projects：專案 ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  code text check (char_length(code) <= 100),
  description text check (char_length(description) <= 5000),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 供複合外鍵使用
  unique (id, user_id),
  unique (user_id, name)
);

-- ---------- calendar_events：行程與工作 ----------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  event_type public.event_type not null default 'other',
  start_at timestamptz not null,
  due_at timestamptz,
  all_day boolean not null default false,
  location text check (char_length(location) <= 300),
  notes text check (char_length(notes) <= 10000),
  priority public.event_priority not null default 'normal',
  status public.event_status not null default 'todo',
  completed_at timestamptz,
  -- 此事件作為期限模板基準（例如：審查會議、會勘、機關通知）
  deadline_base public.deadline_base_kind,
  -- 由期限模板自動產生的事件
  source_event_id uuid,
  deadline_rule_id uuid,
  calculation_detail jsonb,
  -- 期限被使用者人工改過，重新計算時不覆蓋
  manually_adjusted boolean not null default false,
  -- 提醒：提前天數（0=當天）；null 表示使用個人預設值
  reminder_offsets smallint[] check (
    reminder_offsets is null
    or (cardinality(reminder_offsets) <= 10 and reminder_offsets <@ array[0,1,2,3,4,5,6,7,14,30]::smallint[])
  ),
  -- 提醒時間（臺北時間）；null 表示使用個人預設值
  reminder_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (due_at is null or due_at >= start_at),
  check (source_event_id is null or source_event_id <> id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (source_event_id, user_id) references public.calendar_events (id, user_id) on delete cascade
);

create index calendar_events_user_start_idx on public.calendar_events (user_id, start_at);
create index calendar_events_user_due_idx on public.calendar_events (user_id, due_at);
create index calendar_events_user_status_idx on public.calendar_events (user_id, status);
create index calendar_events_source_idx on public.calendar_events (source_event_id);
create index calendar_events_project_idx on public.calendar_events (project_id);
-- 每個基準事件、每條規則只產生一筆期限（避免重複產生）
create unique index calendar_events_rule_once_idx
  on public.calendar_events (source_event_id, deadline_rule_id)
  where source_event_id is not null and deadline_rule_id is not null;

-- ---------- deadline_rules：期限模板（每位使用者各自一份） ----------
create table public.deadline_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  base_kind public.deadline_base_kind not null,
  -- 正數＝基準日後第 N 個工作天；負數＝基準日前第 N 個工作天
  offset_business_days smallint not null check (offset_business_days between -60 and 60 and offset_business_days <> 0),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  generated_event_type public.event_type not null default 'other',
  generated_priority public.event_priority not null default 'normal',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  -- 系統預設規則代碼（使用者自訂規則為 null）
  default_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, default_key)
);

alter table public.calendar_events
  add constraint calendar_events_rule_fk
  foreign key (deadline_rule_id, user_id) references public.deadline_rules (id, user_id) on delete set null (deadline_rule_id);

-- ---------- holidays：臺灣辦公日曆 ----------
-- user_id 為 null：官方日曆（全體共用、唯讀，由後端或管理流程以 service role 匯入）
-- user_id 有值：該使用者的人工調整（特殊辦公日／停止辦公），優先於官方日曆
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kind public.holiday_kind not null,
  description text check (char_length(description) <= 200),
  source text check (char_length(source) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index holidays_official_date_idx on public.holidays (date) where user_id is null;
create unique index holidays_user_date_idx on public.holidays (user_id, date) where user_id is not null;

-- 各年度官方日曆是否完整（未完整年度的期限標示「暫估」）
create table public.holiday_years (
  year smallint primary key check (year between 2000 and 2200),
  is_complete boolean not null default false,
  source text,
  imported_at timestamptz not null default now()
);

-- ---------- notification_preferences：提醒偏好 ----------
create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  default_offsets smallint[] not null default array[7,3,1,0]::smallint[] check (
    cardinality(default_offsets) <= 10 and default_offsets <@ array[0,1,2,3,4,5,6,7,14,30]::smallint[]
  ),
  default_time time not null default '09:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- push_subscriptions：Web Push 訂閱（綁定使用者＋裝置） ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 推播服務端點即代表一個瀏覽器／裝置，全系統唯一
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth_secret text not null check (char_length(auth_secret) between 8 and 100),
  device_label text check (char_length(device_label) <= 100),
  user_agent text check (char_length(user_agent) <= 500),
  failure_count integer not null default 0,
  last_success_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------- notification_jobs：待發送提醒（由資料庫觸發程序建立） ----------
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null,
  offset_days smallint not null check (offset_days between 0 and 30),
  scheduled_for timestamptz not null,
  status public.notification_job_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 防止重複：同一事件、同一提前天數、同一排定時間只會有一筆
  unique (event_id, offset_days, scheduled_for),
  foreign key (event_id, user_id) references public.calendar_events (id, user_id) on delete cascade
);

create index notification_jobs_due_idx on public.notification_jobs (next_attempt_at)
  where status in ('pending', 'failed', 'processing');
create index notification_jobs_user_idx on public.notification_jobs (user_id);

-- ---------- notification_logs：發送紀錄 ----------
create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.notification_jobs (id) on delete set null,
  subscription_id uuid references public.push_subscriptions (id) on delete set null,
  kind text not null default 'reminder' check (kind in ('reminder', 'test')),
  success boolean not null,
  http_status integer,
  error text check (char_length(error) <= 2000),
  created_at timestamptz not null default now()
);

create index notification_logs_user_idx on public.notification_logs (user_id, created_at desc);

-- ---------- updated_at 觸發程序 ----------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();
create trigger deadline_rules_updated_at before update on public.deadline_rules
  for each row execute function public.set_updated_at();
create trigger holidays_updated_at before update on public.holidays
  for each row execute function public.set_updated_at();
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
create trigger notification_jobs_updated_at before update on public.notification_jobs
  for each row execute function public.set_updated_at();

-- 完成時間：狀態改為完成時自動填入，改回未完成時清除
create or replace function public.set_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger calendar_events_completed_at before insert or update of status on public.calendar_events
  for each row execute function public.set_completed_at();
