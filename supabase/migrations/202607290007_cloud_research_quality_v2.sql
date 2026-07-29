begin;

alter table public.cloud_market_research_reports
drop constraint if exists cloud_market_research_reports_engine_version_check;

alter table public.cloud_market_research_reports
add constraint cloud_market_research_reports_engine_version_check
check (engine_version in ('research-rules-v1', 'research-rules-v2'));

commit;
