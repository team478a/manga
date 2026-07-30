begin;

create table public.cloud_story_scenario_versions (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,
  proposal_selection_id uuid not null references public.cloud_story_proposal_selections(id) on delete restrict,
  parent_version_id uuid references public.cloud_story_scenario_versions(id) on delete restrict,
  revision_instruction text check (
    revision_instruction is null or char_length(revision_instruction) between 1 and 2000
  ),
  result jsonb not null check (
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
  ),
  engine_version text not null check (engine_version = 'openai-scenario-v1'),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (parent_version_id is null and revision_instruction is null)
    or (parent_version_id is not null and revision_instruction is not null)
  )
);
create index cloud_story_scenario_versions_owner_idx
  on public.cloud_story_scenario_versions(owner_profile_id, created_at desc);
create index cloud_story_scenario_versions_selection_idx
  on public.cloud_story_scenario_versions(proposal_selection_id, created_at desc);
alter table public.cloud_story_scenario_versions enable row level security;
grant select, insert on public.cloud_story_scenario_versions to authenticated;
grant select, insert, delete on public.cloud_story_scenario_versions to service_role;
create policy "cloud_story_scenario_versions_owner_read"
  on public.cloud_story_scenario_versions for select
  using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_scenario_versions_owner_insert"
  on public.cloud_story_scenario_versions for insert
  with check (
    owner_profile_id = public.current_profile_id()
    and exists (
      select 1 from public.cloud_story_proposal_selections selection
      join public.cloud_market_research_reports report
        on report.id = selection.research_report_id
      where selection.id = proposal_selection_id
        and selection.owner_profile_id = public.current_profile_id()
        and selection.research_report_id = research_report_id
        and report.owner_profile_id = public.current_profile_id()
        and report.input->>'contentClass' = 'general'
    )
    and (
      parent_version_id is null
      or exists (
        select 1 from public.cloud_story_scenario_versions parent
        where parent.id = parent_version_id
          and parent.owner_profile_id = public.current_profile_id()
          and parent.proposal_selection_id = proposal_selection_id
      )
    )
  );

create table public.cloud_story_scenario_adoptions (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  proposal_selection_id uuid not null references public.cloud_story_proposal_selections(id) on delete restrict,
  scenario_version_id uuid not null references public.cloud_story_scenario_versions(id) on delete restrict,
  adopted_at timestamptz not null default now(),
  unique (proposal_selection_id, scenario_version_id)
);
create index cloud_story_scenario_adoptions_owner_idx
  on public.cloud_story_scenario_adoptions(owner_profile_id, adopted_at desc);
create index cloud_story_scenario_adoptions_selection_idx
  on public.cloud_story_scenario_adoptions(proposal_selection_id, adopted_at desc);
alter table public.cloud_story_scenario_adoptions enable row level security;
grant select, insert on public.cloud_story_scenario_adoptions to authenticated;
grant select, insert, delete on public.cloud_story_scenario_adoptions to service_role;
create policy "cloud_story_scenario_adoptions_owner_read"
  on public.cloud_story_scenario_adoptions for select
  using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_scenario_adoptions_owner_insert"
  on public.cloud_story_scenario_adoptions for insert
  with check (
    owner_profile_id = public.current_profile_id()
    and exists (
      select 1 from public.cloud_story_scenario_versions version
      where version.id = scenario_version_id
        and version.owner_profile_id = public.current_profile_id()
        and version.proposal_selection_id = proposal_selection_id
    )
  );

commit;
