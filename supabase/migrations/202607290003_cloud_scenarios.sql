begin;

create table public.cloud_scenario_runs (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  proposal_selection_id uuid not null references public.cloud_story_proposal_selections(id) on delete restrict,
  research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,
  parent_run_id uuid references public.cloud_scenario_runs(id) on delete restrict,
  revision_number integer not null check (revision_number between 1 and 1000),
  status text not null check (status = 'completed'),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result->>'engineVersion' = 'scenario-rules-v1'
    and result->>'classification' = 'ai_inference'
    and (result->>'totalPages')::integer between 1 and 2000
    and jsonb_typeof(result->'characters') = 'array'
    and jsonb_array_length(result->'characters') = 3
    and jsonb_typeof(result->'acts') = 'array'
    and jsonb_array_length(result->'acts') = 3
    and jsonb_typeof(result->'scenes') = 'array'
    and jsonb_array_length(result->'scenes') between 1 and 8
    and pg_column_size(result) <= 262144
  ),
  engine_version text not null check (engine_version = 'scenario-rules-v1'),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (proposal_selection_id, revision_number)
);

create index cloud_scenario_runs_owner_idx
on public.cloud_scenario_runs(owner_profile_id, created_at desc);
create index cloud_scenario_runs_selection_idx
on public.cloud_scenario_runs(proposal_selection_id, revision_number desc);

alter table public.cloud_scenario_runs enable row level security;
grant select on public.cloud_scenario_runs to authenticated;
grant select, insert, delete on public.cloud_scenario_runs to service_role;

create policy "cloud_scenario_runs_owner_read"
on public.cloud_scenario_runs for select
using (owner_profile_id = public.current_profile_id());

create or replace function public.create_cloud_scenario_run(
  p_proposal_selection_id uuid,
  p_parent_run_id uuid,
  p_result jsonb,
  p_completed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_selection public.cloud_story_proposal_selections%rowtype;
  v_parent public.cloud_scenario_runs%rowtype;
  v_report public.cloud_market_research_reports%rowtype;
  v_revision integer;
  v_id uuid;
begin
  if v_profile_id is null then
    raise exception 'cloud_scenario_auth_required';
  end if;
  select * into v_selection
  from public.cloud_story_proposal_selections
  where id = p_proposal_selection_id
    and owner_profile_id = v_profile_id;
  if not found then
    raise exception 'cloud_scenario_selection_not_found';
  end if;
  select * into v_report
  from public.cloud_market_research_reports
  where id = v_selection.research_report_id
    and owner_profile_id = v_profile_id
    and status = 'completed'
    and input->>'contentClass' = 'general';
  if not found then
    raise exception 'cloud_scenario_research_not_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_proposal_selection_id::text, 0));
  if exists (
    select 1
    from public.cloud_scenario_confirmations
    where proposal_selection_id = p_proposal_selection_id
  ) then
    raise exception 'cloud_scenario_already_confirmed';
  end if;
  select coalesce(max(revision_number), 0) + 1 into v_revision
  from public.cloud_scenario_runs
  where proposal_selection_id = p_proposal_selection_id;
  if v_revision = 1 and (
    p_parent_run_id is not null
    or p_result->>'revisionFocus' is distinct from 'initial'
  ) then
    raise exception 'cloud_scenario_initial_invalid';
  end if;
  if v_revision > 1 and (
    p_parent_run_id is null
    or p_result->>'revisionFocus' not in ('pacing', 'character', 'clarity')
  ) then
    raise exception 'cloud_scenario_revision_invalid';
  end if;
  if p_parent_run_id is not null then
    select * into v_parent
    from public.cloud_scenario_runs
    where id = p_parent_run_id
      and owner_profile_id = v_profile_id
      and proposal_selection_id = p_proposal_selection_id;
    if not found then
      raise exception 'cloud_scenario_parent_not_found';
    end if;
  end if;
  if p_result->'proposalTrace'->>'proposalSelectionId' is distinct from p_proposal_selection_id::text
    or p_result->'proposalTrace'->>'candidateId' is distinct from v_selection.candidate_id
    or p_result->'proposalTrace'->>'researchReportId' is distinct from v_selection.research_report_id::text
    or p_result->'proposalTrace'->'sourceUrls' is distinct from v_selection.candidate_snapshot->'sourceUrls'
    or (p_result->>'totalPages')::integer is distinct from (v_report.input->>'pageCount')::integer
  then
    raise exception 'cloud_scenario_trace_invalid';
  end if;
  insert into public.cloud_scenario_runs(
    owner_profile_id,
    proposal_selection_id,
    research_report_id,
    parent_run_id,
    revision_number,
    status,
    result,
    engine_version,
    completed_at
  ) values (
    v_profile_id,
    p_proposal_selection_id,
    v_selection.research_report_id,
    p_parent_run_id,
    v_revision,
    'completed',
    p_result,
    'scenario-rules-v1',
    p_completed_at
  ) returning id into v_id;
  return v_id;
end
$$;

revoke all on function public.create_cloud_scenario_run(uuid,uuid,jsonb,timestamptz)
from public, anon;
grant execute on function public.create_cloud_scenario_run(uuid,uuid,jsonb,timestamptz)
to authenticated, service_role;

create table public.cloud_scenario_confirmations (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  proposal_selection_id uuid not null references public.cloud_story_proposal_selections(id) on delete restrict,
  scenario_run_id uuid not null references public.cloud_scenario_runs(id) on delete restrict,
  scenario_snapshot jsonb not null check (
    jsonb_typeof(scenario_snapshot) = 'object'
    and scenario_snapshot->>'engineVersion' = 'scenario-rules-v1'
    and pg_column_size(scenario_snapshot) <= 262144
  ),
  confirmed_at timestamptz not null default now(),
  unique (proposal_selection_id)
);

create index cloud_scenario_confirmations_owner_idx
on public.cloud_scenario_confirmations(owner_profile_id, confirmed_at desc);

alter table public.cloud_scenario_confirmations enable row level security;
grant select, insert on public.cloud_scenario_confirmations to authenticated;
grant select, insert, delete on public.cloud_scenario_confirmations to service_role;

create policy "cloud_scenario_confirmations_owner_read"
on public.cloud_scenario_confirmations for select
using (owner_profile_id = public.current_profile_id());

create policy "cloud_scenario_confirmations_owner_insert"
on public.cloud_scenario_confirmations for insert
with check (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_scenario_runs run
    where run.id = scenario_run_id
      and run.owner_profile_id = public.current_profile_id()
      and run.proposal_selection_id = proposal_selection_id
      and run.result = scenario_snapshot
  )
);

commit;
