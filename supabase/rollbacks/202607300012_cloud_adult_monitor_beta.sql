begin;

do $$
begin
  if exists(select 1 from public.cloud_adult_monitor_feedback)
    or exists(select 1 from public.cloud_adult_monitor_ai_usage)
  then
    raise exception 'cloud_adult_monitor_data_exists';
  end if;
end;
$$;

create or replace function public.can_use_cloud_adult_research()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.cloud_adult_research_settings settings
    join public.cloud_adult_research_entitlements entitlement on true
    join public.cloud_adult_research_consents consent
      on consent.profile_id=entitlement.profile_id
    where settings.singleton
      and settings.enabled
      and entitlement.profile_id=public.current_profile_id()
      and entitlement.status='approved'
      and (
        entitlement.valid_until is null
        or entitlement.valid_until>now()
      )
      and consent.terms_version='adult-research-v1'
      and consent.withdrawn_at is null
  );
$$;

drop function if exists public.stop_cloud_adult_monitor(uuid,uuid,text,text);
drop function if exists public.activate_cloud_adult_monitor(
  uuid,uuid,text,timestamptz,integer,text,text
);
drop function if exists public.consume_cloud_adult_monitor_ai_request(uuid,text);
drop function if exists public.can_use_cloud_adult_monitor();
drop table if exists public.cloud_adult_monitor_audit_logs;
drop table if exists public.cloud_adult_monitor_feedback;
drop table if exists public.cloud_adult_monitor_ai_usage;
drop table if exists public.cloud_adult_monitor_enrollments;

commit;
