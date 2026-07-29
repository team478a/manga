begin;

do $$
begin
  if exists (
    select 1
    from public.cloud_market_research_reports
    where engine_version = 'openai-web-research-v1'
  ) then
    raise exception 'cloud_research_ai_reports_exist';
  end if;
  if exists (
    select 1
    from public.cloud_research_ai_settings
    where secret_id is not null
  ) then
    raise exception 'cloud_research_ai_secret_must_be_removed_before_rollback';
  end if;
end $$;

drop function if exists public.get_cloud_research_ai_runtime_config();
drop function if exists public.set_cloud_research_ai_provider(
  uuid,
  text,
  text,
  boolean
);
drop table if exists public.cloud_research_ai_audit_logs;
drop table if exists public.cloud_research_ai_settings;

alter table public.cloud_market_research_reports
drop constraint if exists cloud_market_research_reports_engine_version_check;

alter table public.cloud_market_research_reports
add constraint cloud_market_research_reports_engine_version_check
check (engine_version in ('research-rules-v1', 'research-rules-v2'));

commit;
