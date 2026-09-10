begin;

do $$
begin
  if exists (
    select 1
    from public.cloud_story_scenario_versions
    where jsonb_typeof(result->'scenes') = 'array'
      and jsonb_array_length(result->'scenes') < 6
  ) then
    raise exception 'cloud_scenario_short_scene_count_rollback_requires_no_short_scenarios';
  end if;
end
$$;

alter table public.cloud_story_scenario_versions
  drop constraint if exists cloud_story_scenario_versions_result_check;

alter table public.cloud_story_scenario_versions
  add constraint cloud_story_scenario_versions_result_check check (
    jsonb_typeof(result) = 'object'
    and result->>'engineVersion' = 'openai-scenario-v1'
    and result->>'classification' = 'ai_inference'
    and result->>'containsGeneratedMarketNumbers' = 'false'
    and jsonb_typeof(result->'characters') = 'array'
    and jsonb_typeof(result->'acts') = 'array'
    and jsonb_array_length(result->'acts') = 3
    and jsonb_typeof(result->'scenes') = 'array'
    and jsonb_array_length(result->'scenes') between 6 and 20
    and pg_column_size(result) <= 262144
  );

commit;
