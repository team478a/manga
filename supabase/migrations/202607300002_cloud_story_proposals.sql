begin;

create table public.cloud_story_proposal_runs (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,
  status text not null check (status = 'completed'),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result->>'engineVersion' = 'openai-proposal-v1'
    and result->>'classification' = 'ai_inference'
    and result->>'containsGeneratedMarketNumbers' = 'false'
    and jsonb_typeof(result->'candidates') = 'array'
    and jsonb_array_length(result->'candidates') = 3
    and pg_column_size(result) <= 131072
  ),
  engine_version text not null check (engine_version = 'openai-proposal-v1'),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index cloud_story_proposal_runs_owner_idx
  on public.cloud_story_proposal_runs(owner_profile_id, created_at desc);
create index cloud_story_proposal_runs_report_idx
  on public.cloud_story_proposal_runs(research_report_id, created_at desc);
alter table public.cloud_story_proposal_runs enable row level security;
grant select, insert on public.cloud_story_proposal_runs to authenticated;
grant select, insert, delete on public.cloud_story_proposal_runs to service_role;
create policy "cloud_story_proposal_runs_owner_read"
  on public.cloud_story_proposal_runs for select
  using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_proposal_runs_owner_insert"
  on public.cloud_story_proposal_runs for insert
  with check (
    owner_profile_id = public.current_profile_id()
    and exists (
      select 1 from public.cloud_market_research_reports report
      where report.id = research_report_id
        and report.owner_profile_id = public.current_profile_id()
        and report.status = 'completed'
        and report.input->>'contentClass' = 'general'
    )
  );

create table public.cloud_story_proposal_selections (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,
  proposal_run_id uuid not null references public.cloud_story_proposal_runs(id) on delete restrict,
  candidate_id text not null check (
    candidate_id in ('candidate-best-fit','candidate-differentiated','candidate-lean-test')
  ),
  candidate_snapshot jsonb not null check (
    jsonb_typeof(candidate_snapshot) = 'object'
    and candidate_snapshot->>'id' = candidate_id
    and pg_column_size(candidate_snapshot) <= 32768
  ),
  selected_at timestamptz not null default now(),
  unique (research_report_id)
);
create index cloud_story_proposal_selections_owner_idx
  on public.cloud_story_proposal_selections(owner_profile_id, selected_at desc);
alter table public.cloud_story_proposal_selections enable row level security;
grant select, insert on public.cloud_story_proposal_selections to authenticated;
grant select, insert, delete on public.cloud_story_proposal_selections to service_role;
create policy "cloud_story_proposal_selections_owner_read"
  on public.cloud_story_proposal_selections for select
  using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_proposal_selections_owner_insert"
  on public.cloud_story_proposal_selections for insert
  with check (
    owner_profile_id = public.current_profile_id()
    and exists (
      select 1 from public.cloud_story_proposal_runs run
      where run.id = proposal_run_id
        and run.owner_profile_id = public.current_profile_id()
        and run.research_report_id = research_report_id
        and exists (
          select 1 from jsonb_array_elements(run.result->'candidates') candidate
          where candidate->>'id' = candidate_id and candidate = candidate_snapshot
        )
    )
  );
commit;
