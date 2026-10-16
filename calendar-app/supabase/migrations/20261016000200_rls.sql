-- =====================================================================
-- 第一階段：Row Level Security 與權限
--
--  * 所有 public 資料表都啟用 RLS（客戶端以 anon / authenticated 角色連線，一律受 RLS 限制）
--  * 每張客戶資料表都明確定義 SELECT / INSERT / UPDATE / DELETE 四種政策
--  * 所有權一律以 auth.uid() 驗證：
--      USING       → 只能看到、修改、刪除 user_id = auth.uid() 的列
--      WITH CHECK  → 新增或修改後的列，user_id 仍必須等於 auth.uid()
--    因此前端即使送出別人的 user_id，也會被資料庫拒絕
--  * anon（未登入）沒有任何資料表權限
--  * 系統管理的表（notification_jobs / notification_logs / holiday_years
--    與官方 holidays）一般使用者只能讀取自己的或公開的資料，不能寫入；
--    寫入只能由後端使用 service_role（存在 Cloudflare Worker 的環境變數）
--  * 沒有任何「管理員可看全部」的政策：一般客戶端無法查看其他客戶的行程
--
-- 註：(select auth.uid()) 的寫法讓 PostgreSQL 每個查詢只計算一次，效能較佳
-- =====================================================================

-- ---------- 啟用 RLS ----------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.calendar_events enable row level security;
alter table public.deadline_rules enable row level security;
alter table public.holidays enable row level security;
alter table public.holiday_years enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_logs enable row level security;


-- ---------- 資料表權限（GRANT）----------
-- Supabase 預設會把 public 資料表權限給 anon / authenticated，這裡全部收回後再明確授權
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.projects,
  public.calendar_events,
  public.deadline_rules,
  public.holidays,
  public.notification_preferences,
  public.push_subscriptions
to authenticated;

-- 系統管理的表：一般使用者只能讀
grant select on public.notification_jobs, public.notification_logs, public.holiday_years to authenticated;

-- 後端（Cloudflare Worker 使用 service_role）
grant all on all tables in schema public to service_role;

-- 避免日後新增的資料表自動開放給 anon / authenticated
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------- 標準「只能存取自己的資料」政策 ----------
-- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (user_id = (select auth.uid()));

-- projects
create policy projects_select_own on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy projects_insert_own on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy projects_update_own on public.projects
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy projects_delete_own on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- calendar_events
create policy calendar_events_select_own on public.calendar_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy calendar_events_insert_own on public.calendar_events
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy calendar_events_update_own on public.calendar_events
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy calendar_events_delete_own on public.calendar_events
  for delete to authenticated using (user_id = (select auth.uid()));

-- deadline_rules
create policy deadline_rules_select_own on public.deadline_rules
  for select to authenticated using (user_id = (select auth.uid()));
create policy deadline_rules_insert_own on public.deadline_rules
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy deadline_rules_update_own on public.deadline_rules
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy deadline_rules_delete_own on public.deadline_rules
  for delete to authenticated using (user_id = (select auth.uid()));

-- notification_preferences
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_delete_own on public.notification_preferences
  for delete to authenticated using (user_id = (select auth.uid()));

-- push_subscriptions（裝置訂閱）
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- holidays：官方日曆共用唯讀；個人調整只能自己存取 ----------
create policy holidays_select_official_or_own on public.holidays
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy holidays_insert_own on public.holidays
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy holidays_update_own on public.holidays
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy holidays_delete_own on public.holidays
  for delete to authenticated using (user_id = (select auth.uid()));

-- holiday_years：公開參考資料，唯讀
create policy holiday_years_select_all on public.holiday_years
  for select to authenticated using (true);
create policy holiday_years_insert_deny on public.holiday_years
  for insert to authenticated with check (false);
create policy holiday_years_update_deny on public.holiday_years
  for update to authenticated using (false) with check (false);
create policy holiday_years_delete_deny on public.holiday_years
  for delete to authenticated using (false);

-- ---------- 系統管理的表：只能讀自己的，寫入一律拒絕 ----------
-- （除了 GRANT 層級沒有寫入權限外，再以 RLS 明確拒絕，雙重保護）
create policy notification_jobs_select_own on public.notification_jobs
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_jobs_insert_deny on public.notification_jobs
  for insert to authenticated with check (false);
create policy notification_jobs_update_deny on public.notification_jobs
  for update to authenticated using (false) with check (false);
create policy notification_jobs_delete_deny on public.notification_jobs
  for delete to authenticated using (false);

create policy notification_logs_select_own on public.notification_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_logs_insert_deny on public.notification_logs
  for insert to authenticated with check (false);
create policy notification_logs_update_deny on public.notification_logs
  for update to authenticated using (false) with check (false);
create policy notification_logs_delete_deny on public.notification_logs
  for delete to authenticated using (false);

-- 觸發程序函式需可被觸發者執行
grant execute on function public.set_updated_at() to authenticated, service_role;
grant execute on function public.set_completed_at() to authenticated, service_role;
