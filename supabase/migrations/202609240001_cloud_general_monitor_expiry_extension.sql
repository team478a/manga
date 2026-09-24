begin;

alter table public.cloud_general_monitor_audit_logs
  drop constraint if exists cloud_general_monitor_audit_logs_action_check;
alter table public.cloud_general_monitor_audit_logs
  add constraint cloud_general_monitor_audit_logs_action_check
  check (action in (
    'activate','pause','complete','revoke','update','invite_email_sent',
    'extend_expiry','expiry_extension_email_sent'
  ));

create or replace function public.extend_cloud_general_monitor_expiry(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_expires_at timestamptz,
  p_admin_note text
) returns table(changed boolean,result_expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare
  v_before public.cloud_general_monitor_enrollments%rowtype;
  v_after public.cloud_general_monitor_enrollments%rowtype;
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then raise exception 'cloud_general_monitor_admin_required'; end if;
  if p_expires_at is null or p_expires_at<=now() then
    raise exception 'cloud_general_monitor_expiry_invalid';
  end if;
  if char_length(trim(coalesce(p_admin_note,''))) not between 1 and 500 then
    raise exception 'cloud_general_monitor_admin_note_invalid';
  end if;

  select * into v_before
  from public.cloud_general_monitor_enrollments
  where profile_id=p_target_profile_id
  for update;
  if not found then raise exception 'cloud_general_monitor_not_found'; end if;
  if v_before.status<>'active' then
    raise exception 'cloud_general_monitor_not_active';
  end if;
  if p_expires_at<=v_before.starts_at then
    raise exception 'cloud_general_monitor_expiry_invalid';
  end if;
  if p_expires_at<v_before.expires_at then
    raise exception 'cloud_general_monitor_expiry_must_not_shorten';
  end if;
  if p_expires_at=v_before.expires_at then
    changed:=false;
    result_expires_at:=v_before.expires_at;
    return next;
    return;
  end if;

  update public.cloud_general_monitor_enrollments
  set expires_at=p_expires_at,updated_at=now()
  where profile_id=p_target_profile_id
  returning * into v_after;
  insert into public.cloud_general_monitor_audit_logs(
    actor_profile_id,target_profile_id,action,before_value,after_value
  ) values(
    p_actor_profile_id,p_target_profile_id,'extend_expiry',to_jsonb(v_before),
    to_jsonb(v_after)||jsonb_build_object('operation_note',trim(p_admin_note))
  );
  changed:=true;
  result_expires_at:=v_after.expires_at;
  return next;
end;
$$;

revoke all on function public.extend_cloud_general_monitor_expiry(
  uuid,uuid,timestamptz,text
) from public,anon,authenticated;
grant execute on function public.extend_cloud_general_monitor_expiry(
  uuid,uuid,timestamptz,text
) to service_role;

create or replace function public.record_cloud_general_monitor_expiry_email_sent(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path=public as $$
declare
  v_enrollment public.cloud_general_monitor_enrollments%rowtype;
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then raise exception 'cloud_general_monitor_admin_required'; end if;
  select * into v_enrollment
  from public.cloud_general_monitor_enrollments
  where profile_id=p_target_profile_id
  for update;
  if not found then raise exception 'cloud_general_monitor_not_found'; end if;
  if v_enrollment.status<>'active' or v_enrollment.expires_at<>p_expires_at then
    raise exception 'cloud_general_monitor_expiry_changed';
  end if;
  if exists(
    select 1 from public.cloud_general_monitor_audit_logs
    where target_profile_id=p_target_profile_id
      and action='expiry_extension_email_sent'
      and (after_value->>'expires_at')::timestamptz=p_expires_at
  ) then return false; end if;
  insert into public.cloud_general_monitor_audit_logs(
    actor_profile_id,target_profile_id,action,before_value,after_value
  ) values(
    p_actor_profile_id,p_target_profile_id,'expiry_extension_email_sent',null,
    jsonb_build_object('expires_at',p_expires_at)
  );
  return true;
end;
$$;

revoke all on function public.record_cloud_general_monitor_expiry_email_sent(
  uuid,uuid,timestamptz
) from public,anon,authenticated;
grant execute on function public.record_cloud_general_monitor_expiry_email_sent(
  uuid,uuid,timestamptz
) to service_role;

commit;
