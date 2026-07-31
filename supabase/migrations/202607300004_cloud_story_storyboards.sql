begin;
create table public.cloud_story_storyboard_versions (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  scenario_version_id uuid not null references public.cloud_story_scenario_versions(id) on delete restrict,
  parent_version_id uuid references public.cloud_story_storyboard_versions(id) on delete restrict,
  revision_instruction text check(revision_instruction is null or char_length(revision_instruction) between 1 and 2000),
  result jsonb not null check(jsonb_typeof(result)='object' and result->>'engineVersion'='openai-storyboard-v1' and result->>'classification'='ai_inference' and result->>'containsGeneratedMarketNumbers'='false' and result->>'readingDirection'='rtl' and jsonb_typeof(result->'pages')='array' and jsonb_array_length(result->'pages') between 8 and 48 and pg_column_size(result)<=1048576),
  engine_version text not null check(engine_version='openai-storyboard-v1'),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check((parent_version_id is null and revision_instruction is null) or(parent_version_id is not null and revision_instruction is not null))
);
create index cloud_story_storyboard_versions_owner_idx on public.cloud_story_storyboard_versions(owner_profile_id,created_at desc);
create index cloud_story_storyboard_versions_scenario_idx on public.cloud_story_storyboard_versions(scenario_version_id,created_at desc);
alter table public.cloud_story_storyboard_versions enable row level security;
grant select,insert on public.cloud_story_storyboard_versions to authenticated;
grant select,insert,delete on public.cloud_story_storyboard_versions to service_role;
create policy "cloud_story_storyboard_versions_owner_read" on public.cloud_story_storyboard_versions for select using(owner_profile_id=public.current_profile_id());
create policy "cloud_story_storyboard_versions_owner_insert" on public.cloud_story_storyboard_versions for insert with check(
  owner_profile_id=public.current_profile_id()
  and exists(
    select 1 from public.cloud_story_scenario_versions scenario
    where scenario.id=scenario_version_id and scenario.owner_profile_id=public.current_profile_id()
      and exists(
        select 1 from public.cloud_story_scenario_adoptions adoption
        where adoption.scenario_version_id=scenario.id and adoption.owner_profile_id=public.current_profile_id()
          and not exists(
            select 1 from public.cloud_story_scenario_adoptions newer
            where newer.proposal_selection_id=adoption.proposal_selection_id
              and (newer.adopted_at,newer.id)>(adoption.adopted_at,adoption.id)
          )
      )
  )
  and(parent_version_id is null or exists(
    select 1 from public.cloud_story_storyboard_versions parent
    where parent.id=parent_version_id and parent.owner_profile_id=public.current_profile_id()
      and parent.scenario_version_id=scenario_version_id
  ))
);
create table public.cloud_story_storyboard_adoptions (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  scenario_version_id uuid not null references public.cloud_story_scenario_versions(id) on delete restrict,
  storyboard_version_id uuid not null references public.cloud_story_storyboard_versions(id) on delete restrict,
  adopted_at timestamptz not null default now(),
  unique(scenario_version_id,storyboard_version_id)
);
create index cloud_story_storyboard_adoptions_owner_idx on public.cloud_story_storyboard_adoptions(owner_profile_id,adopted_at desc);
create index cloud_story_storyboard_adoptions_scenario_idx on public.cloud_story_storyboard_adoptions(scenario_version_id,adopted_at desc);
alter table public.cloud_story_storyboard_adoptions enable row level security;
grant select,insert on public.cloud_story_storyboard_adoptions to authenticated;
grant select,insert,delete on public.cloud_story_storyboard_adoptions to service_role;
create policy "cloud_story_storyboard_adoptions_owner_read" on public.cloud_story_storyboard_adoptions for select using(owner_profile_id=public.current_profile_id());
create policy "cloud_story_storyboard_adoptions_owner_insert" on public.cloud_story_storyboard_adoptions for insert with check(
  owner_profile_id=public.current_profile_id()
  and exists(select 1 from public.cloud_story_storyboard_versions version
    where version.id=storyboard_version_id and version.owner_profile_id=public.current_profile_id()
      and version.scenario_version_id=scenario_version_id)
);
commit;
