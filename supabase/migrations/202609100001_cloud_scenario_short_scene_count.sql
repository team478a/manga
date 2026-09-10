begin;

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
    and jsonb_array_length(result->'scenes') between 3 and 20
    and pg_column_size(result) <= 262144
  );

commit;
