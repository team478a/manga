begin;

alter table public.cloud_monitor_quality_review_assignments
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_send_count integer not null default 0
    check(notification_send_count>=0);

create or replace function public.record_cloud_monitor_quality_review_notification_sent(
  p_actor_profile_id uuid,
  p_assignment_id uuid
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.profiles where id=p_actor_profile_id and role='admin'
  ) then raise exception 'monitor_quality_review_admin_required';end if;
  update public.cloud_monitor_quality_review_assignments
  set notification_sent_at=now(),notification_send_count=notification_send_count+1,updated_at=now()
  where id=p_assignment_id and status<>'revoked';
  if not found then raise exception 'monitor_quality_review_assignment_unavailable';end if;
end$$;

revoke all on function public.record_cloud_monitor_quality_review_notification_sent(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.record_cloud_monitor_quality_review_notification_sent(uuid,uuid)
  to service_role;

commit;
