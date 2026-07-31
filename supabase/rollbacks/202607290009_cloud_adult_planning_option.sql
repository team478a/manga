begin;

do $$
begin
  if exists (select 1 from public.cloud_adult_planning_briefs) then
    raise exception 'cloud_adult_planning_briefs_exist';
  end if;
end $$;

drop table if exists public.cloud_adult_planning_briefs;
drop function if exists public.can_use_cloud_adult_feature(text);
drop function if exists public.set_cloud_adult_feature_grant(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  text
);

-- allow-destructive: rollback removes Release 1.2 grants after the brief guard.
drop table if exists public.cloud_adult_feature_grants;

alter table public.cloud_adult_research_audit_logs
drop constraint if exists cloud_adult_research_audit_logs_action_check;

alter table public.cloud_adult_research_audit_logs
add constraint cloud_adult_research_audit_logs_action_check
check (
  action in (
    'grant',
    'update',
    'suspend',
    'expire',
    'consent',
    'withdraw_consent',
    'enable_global',
    'disable_global'
  )
);

commit;
