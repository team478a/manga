begin;

do $$
begin
  if exists (
    select 1
    from public.cloud_market_research_reports
    where engine_version = 'research-rules-v2'
  ) then
    raise exception 'cloud_research_quality_v2_reports_exist';
  end if;
end $$;

alter table public.cloud_market_research_reports
drop constraint if exists cloud_market_research_reports_engine_version_check;

alter table public.cloud_market_research_reports
add constraint cloud_market_research_reports_engine_version_check
check (engine_version = 'research-rules-v1');

commit;
