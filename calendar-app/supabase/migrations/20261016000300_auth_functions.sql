-- =====================================================================
-- 第一階段：帳號相關函式
--  * 註冊成功後自動建立個人設定、提醒偏好、預設期限模板
--  * 推播訂閱註冊（綁定目前登入使用者＋裝置）
--  * 匯出自己的資料
--
-- SECURITY DEFINER 函式一律：
--   - set search_path = ''（避免 search_path 劫持）
--   - 只使用 auth.uid()，不接受外部傳入的 user_id
--   - 收回 PUBLIC 執行權，只授權給需要的角色
-- =====================================================================

-- ---------- 預設期限模板 ----------
create or replace function public.seed_default_deadline_rules(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.deadline_rules
    (user_id, base_kind, offset_business_days, title, generated_event_type, generated_priority, sort_order, default_key)
  values
    (p_user_id, 'agency_notice',  12, '公文發文掛件', 'document_reply',   'high',   10, 'agency_notice_dispatch'),
    (p_user_id, 'review_meeting', -2, '寄送簡報',     'presentation',     'high',   20, 'review_send_slides'),
    (p_user_id, 'review_meeting',  1, '寄送會議紀錄', 'other',            'normal', 30, 'review_send_minutes'),
    (p_user_id, 'review_meeting',  3, '發送修正圖說', 'drawing_revision', 'high',   40, 'review_send_revised_drawings'),
    (p_user_id, 'site_visit',     -2, '上傳簡報',     'presentation',     'high',   50, 'site_upload_slides'),
    (p_user_id, 'site_visit',      1, '寄送會勘紀錄', 'other',            'normal', 60, 'site_send_minutes')
  on conflict (user_id, default_key) do nothing;
$$;

-- 僅供內部（註冊觸發程序）使用，不開放給客戶端，避免替別人建立資料
revoke all on function public.seed_default_deadline_rules(uuid) from public, anon, authenticated;

-- ---------- 註冊後自動建立個人設定 ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 100), '')
  )
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform public.seed_default_deadline_rules(new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 使用者自行還原預設期限模板 ----------
create or replace function public.restore_default_deadline_rules()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '尚未登入' using errcode = '42501';
  end if;
  perform public.seed_default_deadline_rules(v_uid);
end;
$$;

revoke all on function public.restore_default_deadline_rules() from public, anon;
grant execute on function public.restore_default_deadline_rules() to authenticated;

-- ---------- 推播訂閱註冊 ----------
-- 一個瀏覽器（endpoint）同一時間只屬於一位使用者：
-- 同一台裝置換人登入時，訂閱轉移給目前登入者，前一位使用者不會再收到這台裝置的通知。
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_device_label text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception '尚未登入' using errcode = '42501';
  end if;

  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id <> v_uid;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret, device_label, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth_secret, left(p_device_label, 100), left(p_user_agent, 500))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth_secret = excluded.auth_secret,
        device_label = coalesce(excluded.device_label, public.push_subscriptions.device_label),
        user_agent = excluded.user_agent,
        failure_count = 0,
        last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated;

-- ---------- 匯出自己的資料 ----------
-- SECURITY INVOKER：以呼叫者身分執行，RLS 自動只回傳自己的資料
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'user_id', auth.uid(),
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = auth.uid()),
    'notification_preferences', (select to_jsonb(n) from public.notification_preferences n where n.user_id = auth.uid()),
    'projects', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.projects x), '[]'::jsonb),
    'calendar_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.start_at) from public.calendar_events x), '[]'::jsonb),
    'deadline_rules', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order) from public.deadline_rules x), '[]'::jsonb),
    'holiday_overrides', coalesce((select jsonb_agg(to_jsonb(x) order by x.date) from public.holidays x where x.user_id is not null), '[]'::jsonb),
    'push_subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'device_label', x.device_label, 'created_at', x.created_at, 'last_seen_at', x.last_seen_at))
      from public.push_subscriptions x), '[]'::jsonb),
    'notification_logs', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.notification_logs x), '[]'::jsonb)
  );
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
