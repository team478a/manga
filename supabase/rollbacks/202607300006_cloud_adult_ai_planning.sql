begin;

do $$
begin
  if exists (select 1 from public.cloud_story_proposal_runs where content_class = 'adult')
     or exists (select 1 from public.cloud_adult_ai_planning_consents)
     or exists (select 1 from public.cloud_adult_feature_grants where feature_key = 'adult_ai_planning')
  then raise exception 'adult_ai_planning_data_exists'; end if;
end;
$$;

drop policy "cloud_story_proposal_selections_owner_read" on public.cloud_story_proposal_selections;
drop policy "cloud_story_proposal_selections_owner_insert" on public.cloud_story_proposal_selections;
create policy "cloud_story_proposal_selections_owner_read"
on public.cloud_story_proposal_selections for select
using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_proposal_selections_owner_insert"
on public.cloud_story_proposal_selections for insert with check (
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
drop policy "cloud_story_proposal_runs_owner_read" on public.cloud_story_proposal_runs;
drop policy "cloud_story_proposal_runs_owner_insert" on public.cloud_story_proposal_runs;
create policy "cloud_story_proposal_runs_owner_read"
on public.cloud_story_proposal_runs for select
using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_proposal_runs_owner_insert"
on public.cloud_story_proposal_runs for insert with check (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_market_research_reports report
    where report.id = research_report_id
      and report.owner_profile_id = public.current_profile_id()
      and report.status = 'completed'
      and report.input->>'contentClass' = 'general'
  )
);
alter table public.cloud_story_proposal_selections drop column content_class;
alter table public.cloud_story_proposal_runs drop column content_class;
drop function public.set_cloud_adult_ai_planning_enabled(uuid, boolean);
drop function public.can_use_cloud_adult_ai_planning();
drop table public.cloud_adult_ai_planning_consents;
drop table public.cloud_adult_ai_planning_settings;
alter table public.cloud_adult_feature_grants
drop constraint cloud_adult_feature_grants_feature_key_check;
alter table public.cloud_adult_feature_grants
add constraint cloud_adult_feature_grants_feature_key_check
check (feature_key in ('adult_planning'));
create or replace function public.can_use_cloud_adult_feature(p_feature_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    p_feature_key = 'adult_planning'
    and public.can_use_cloud_adult_research()
    and exists (
      select 1 from public.cloud_adult_feature_grants feature_grant
      where feature_grant.profile_id = public.current_profile_id()
        and feature_grant.feature_key = p_feature_key
        and feature_grant.status = 'approved'
        and (feature_grant.valid_until is null or feature_grant.valid_until > now())
    );
$$;

commit;
