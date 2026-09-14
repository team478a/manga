begin;

alter table public.cloud_story_storyboard_versions
  drop constraint if exists cloud_story_storyboard_versions_result_check;

alter table public.cloud_story_storyboard_versions
  add constraint cloud_story_storyboard_versions_result_check check (
    jsonb_typeof(result) = 'object'
    and result->>'engineVersion' = 'openai-storyboard-v1'
    and result->>'classification' = 'ai_inference'
    and result->>'containsGeneratedMarketNumbers' = 'false'
    and result->>'readingDirection' = 'rtl'
    and jsonb_typeof(result->'pages') = 'array'
    and jsonb_array_length(result->'pages') between 4 and 48
    and pg_column_size(result) <= 1048576
  );

commit;
