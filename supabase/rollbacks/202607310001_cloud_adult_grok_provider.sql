begin;

do $$
begin
  if exists (
    select 1 from public.cloud_market_research_reports
    where engine_version = 'xai-adult-web-research-v1'
  ) or exists (
    select 1 from public.cloud_story_proposal_runs
    where engine_version = 'xai-adult-proposal-v1'
  ) or exists (
    select 1 from public.cloud_story_scenario_versions
    where engine_version = 'xai-adult-scenario-v1'
  ) or exists (
    select 1 from public.cloud_story_storyboard_versions
    where engine_version = 'xai-adult-storyboard-v1'
  ) then raise exception 'cloud_adult_grok_generated_records_exist'; end if;
  if exists (
    select 1 from public.cloud_adult_grok_settings where secret_id is not null
  ) then raise exception 'cloud_adult_grok_secret_must_be_removed_before_rollback'; end if;
end $$;

drop function if exists public.get_cloud_adult_grok_runtime_config();
drop function if exists public.set_cloud_adult_grok_provider(uuid,text,text,boolean);
drop table if exists public.cloud_adult_grok_audit_logs;
drop table if exists public.cloud_adult_grok_settings;

alter table public.cloud_market_research_reports
drop constraint if exists cloud_market_research_reports_engine_version_check;
alter table public.cloud_market_research_reports
add constraint cloud_market_research_reports_engine_version_check
check (engine_version in ('research-rules-v1','research-rules-v2','openai-web-research-v1'));

alter table public.cloud_story_proposal_runs
drop constraint if exists cloud_story_proposal_runs_result_check;
alter table public.cloud_story_proposal_runs
drop constraint if exists cloud_story_proposal_runs_engine_version_check;
alter table public.cloud_story_proposal_runs
add constraint cloud_story_proposal_runs_result_check check (
  jsonb_typeof(result)='object' and result->>'engineVersion'='openai-proposal-v1'
  and result->>'classification'='ai_inference'
  and result->>'containsGeneratedMarketNumbers'='false'
  and jsonb_typeof(result->'candidates')='array'
  and jsonb_array_length(result->'candidates')=3 and pg_column_size(result)<=131072
);
alter table public.cloud_story_proposal_runs
add constraint cloud_story_proposal_runs_engine_version_check
check (engine_version='openai-proposal-v1');

alter table public.cloud_story_scenario_versions
drop constraint if exists cloud_story_scenario_versions_result_check;
alter table public.cloud_story_scenario_versions
drop constraint if exists cloud_story_scenario_versions_engine_version_check;
alter table public.cloud_story_scenario_versions
add constraint cloud_story_scenario_versions_result_check check (
  jsonb_typeof(result)='object' and result->>'engineVersion'='openai-scenario-v1'
  and result->>'classification'='ai_inference'
  and result->>'containsGeneratedMarketNumbers'='false'
  and jsonb_typeof(result->'characters')='array'
  and jsonb_typeof(result->'acts')='array' and jsonb_array_length(result->'acts')=3
  and jsonb_typeof(result->'scenes')='array'
  and jsonb_array_length(result->'scenes') between 6 and 20
  and pg_column_size(result)<=262144
);
alter table public.cloud_story_scenario_versions
add constraint cloud_story_scenario_versions_engine_version_check
check (engine_version='openai-scenario-v1');

alter table public.cloud_story_storyboard_versions
drop constraint if exists cloud_story_storyboard_versions_result_check;
alter table public.cloud_story_storyboard_versions
drop constraint if exists cloud_story_storyboard_versions_engine_version_check;
alter table public.cloud_story_storyboard_versions
add constraint cloud_story_storyboard_versions_result_check check (
  jsonb_typeof(result)='object' and result->>'engineVersion'='openai-storyboard-v1'
  and result->>'classification'='ai_inference'
  and result->>'containsGeneratedMarketNumbers'='false'
  and result->>'readingDirection'='rtl'
  and jsonb_typeof(result->'pages')='array'
  and jsonb_array_length(result->'pages') between 8 and 48
  and pg_column_size(result)<=1048576
);
alter table public.cloud_story_storyboard_versions
add constraint cloud_story_storyboard_versions_engine_version_check
check (engine_version='openai-storyboard-v1');

commit;
