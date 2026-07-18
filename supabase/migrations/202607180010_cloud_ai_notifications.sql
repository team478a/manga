begin;

create table public.cloud_ai_notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check(audience in('user','admin')),
  profile_id uuid references public.profiles(id) on delete cascade,
  notification_type text not null check(notification_type in('quota_warning','job_failed','budget_warning','generation_stopped')),
  severity text not null check(severity in('info','warning','critical')),
  title text not null check(char_length(title) between 1 and 200),
  body text not null check(char_length(body) between 1 and 1000),
  source_id text,
  dedupe_key text not null unique check(char_length(dedupe_key) between 1 and 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check((audience='user' and profile_id is not null) or (audience='admin' and profile_id is null))
);
create index cloud_ai_notifications_profile_idx on public.cloud_ai_notifications(profile_id,created_at desc) where profile_id is not null;
create index cloud_ai_notifications_admin_idx on public.cloud_ai_notifications(created_at desc) where audience='admin';
alter table public.cloud_ai_notifications enable row level security;
grant select on public.cloud_ai_notifications to authenticated;
grant update(read_at) on public.cloud_ai_notifications to authenticated;
grant select,insert,update on public.cloud_ai_notifications to service_role;
create policy "cloud_ai_notifications_user_read" on public.cloud_ai_notifications for select using(profile_id=public.current_profile_id());
create policy "cloud_ai_notifications_user_update" on public.cloud_ai_notifications for update using(profile_id=public.current_profile_id()) with check(profile_id=public.current_profile_id());

create or replace function public.refresh_cloud_ai_notifications()
returns integer language plpgsql security definer set search_path=public as $$
declare v_before bigint;v_settings public.cloud_ai_settings%rowtype;v_daily public.cloud_ai_daily_costs%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_notification_refresh_not_authorized';end if;
  select count(*) into v_before from public.cloud_ai_notifications;
  select * into v_settings from public.cloud_ai_settings where singleton;
  select * into v_daily from public.cloud_ai_daily_costs where usage_date=current_date;
  if found and v_settings.daily_cost_limit_micros>0 and (v_daily.cost_actual_micros+v_daily.cost_reserved_micros)*100>=v_settings.daily_cost_limit_micros*v_settings.warning_percent then
    insert into public.cloud_ai_notifications(audience,notification_type,severity,title,body,source_id,dedupe_key) values('admin','budget_warning','warning','Cloud AI日次予算警告','実費と予約原価が設定した警告率へ到達しました。',current_date::text,'admin:budget:'||current_date) on conflict(dedupe_key) do nothing;
  end if;
  if not v_settings.generation_enabled then
    insert into public.cloud_ai_notifications(audience,notification_type,severity,title,body,source_id,dedupe_key) values('admin','generation_stopped','critical','Cloud AI生成停止中','全体kill switchまたは日次予算自動停止により生成が停止しています。','global','admin:stopped:'||extract(epoch from v_settings.updated_at)::bigint) on conflict(dedupe_key) do nothing;
  end if;
  insert into public.cloud_ai_notifications(audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key)
  select 'user',j.created_by_profile_id,'job_failed','warning','AI生成に失敗しました',coalesce(nullif(j.error_message,''),'生成Jobを完了できませんでした。'),j.id::text,'user:job-failed:'||j.id
  from public.cloud_generation_jobs j where j.status='failed' and j.finished_at>=now()-interval '30 days' on conflict(dedupe_key) do nothing;
  insert into public.cloud_ai_notifications(audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key)
  select 'user',u.profile_id,'quota_warning','warning','Cloud AI利用枠が少なくなっています','使用済み・予約済みcreditがPlan上限の警告率へ到達しました。',u.period_starts_at::text,'user:quota:'||u.profile_id||':'||extract(epoch from u.period_starts_at)::bigint
  from public.cloud_ai_usage_periods u join public.cloud_ai_plans p on p.plan_key=u.plan_key
  where p.monthly_credits>0 and (u.credits_used+u.credits_reserved)*100>=p.monthly_credits*v_settings.warning_percent on conflict(dedupe_key) do nothing;
  return (select count(*) from public.cloud_ai_notifications)-v_before;
end $$;
revoke all on function public.refresh_cloud_ai_notifications() from public,anon,authenticated;
grant execute on function public.refresh_cloud_ai_notifications() to service_role;

commit;
