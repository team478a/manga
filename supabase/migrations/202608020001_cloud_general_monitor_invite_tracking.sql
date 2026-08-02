begin;

alter table public.cloud_general_monitor_enrollments
  add column if not exists invite_email_sent_at timestamptz,
  add column if not exists invite_email_send_count integer not null default 0
    check (invite_email_send_count>=0);

alter table public.cloud_general_monitor_audit_logs
  drop constraint if exists cloud_general_monitor_audit_logs_action_check;
alter table public.cloud_general_monitor_audit_logs
  add constraint cloud_general_monitor_audit_logs_action_check
    check (action in (
      'activate','pause','complete','revoke','update','invite_email_sent'
    ));

create or replace function public.record_cloud_general_monitor_invite_email_sent(
  p_actor_profile_id uuid,
  p_target_profile_id uuid
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if auth.role()<>'service_role' or not exists (
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then
    raise exception 'cloud_general_monitor_admin_required';
  end if;

  select to_jsonb(enrollment) into v_before
  from public.cloud_general_monitor_enrollments enrollment
  where enrollment.profile_id=p_target_profile_id
  for update;
  if v_before is null then
    raise exception 'cloud_general_monitor_not_found';
  end if;

  update public.cloud_general_monitor_enrollments
  set invite_email_sent_at=now(),
      invite_email_send_count=invite_email_send_count+1,
      updated_at=now()
  where profile_id=p_target_profile_id;

  select to_jsonb(enrollment) into v_after
  from public.cloud_general_monitor_enrollments enrollment
  where enrollment.profile_id=p_target_profile_id;

  insert into public.cloud_general_monitor_audit_logs(
    actor_profile_id,target_profile_id,action,before_value,after_value
  ) values(
    p_actor_profile_id,p_target_profile_id,'invite_email_sent',v_before,v_after
  );
end
$$;

revoke all on function public.record_cloud_general_monitor_invite_email_sent(
  uuid,uuid
) from public,anon,authenticated;
grant execute on function public.record_cloud_general_monitor_invite_email_sent(
  uuid,uuid
) to service_role;

commit;
