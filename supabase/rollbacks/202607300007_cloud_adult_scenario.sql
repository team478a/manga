begin;

do $$
begin
  if exists (select 1 from public.cloud_story_scenario_versions where content_class = 'adult')
     or exists (select 1 from public.cloud_adult_scenario_consents)
     or exists (select 1 from public.cloud_adult_feature_grants where feature_key = 'adult_scenario')
  then raise exception 'adult_scenario_data_exists'; end if;
end;
$$;

drop policy "cloud_story_storyboard_versions_owner_insert"
on public.cloud_story_storyboard_versions;
create policy "cloud_story_storyboard_versions_owner_insert"
on public.cloud_story_storyboard_versions for insert with check (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_story_scenario_versions scenario
    where scenario.id = scenario_version_id
      and scenario.owner_profile_id = public.current_profile_id()
      and exists (
        select 1 from public.cloud_story_scenario_adoptions adoption
        where adoption.scenario_version_id = scenario.id
          and adoption.owner_profile_id = public.current_profile_id()
          and not exists (
            select 1 from public.cloud_story_scenario_adoptions newer
            where newer.proposal_selection_id = adoption.proposal_selection_id
              and (newer.adopted_at, newer.id) > (adoption.adopted_at, adoption.id)
          )
      )
  )
  and (
    parent_version_id is null
    or exists (
      select 1 from public.cloud_story_storyboard_versions parent
      where parent.id = parent_version_id
        and parent.owner_profile_id = public.current_profile_id()
        and parent.scenario_version_id = scenario_version_id
    )
  )
);

drop policy "cloud_story_scenario_adoptions_owner_read" on public.cloud_story_scenario_adoptions;
drop policy "cloud_story_scenario_adoptions_owner_insert" on public.cloud_story_scenario_adoptions;
create policy "cloud_story_scenario_adoptions_owner_read"
on public.cloud_story_scenario_adoptions for select
using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_scenario_adoptions_owner_insert"
on public.cloud_story_scenario_adoptions for insert with check (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_story_scenario_versions version
    where version.id = scenario_version_id
      and version.owner_profile_id = public.current_profile_id()
      and version.proposal_selection_id = proposal_selection_id
  )
);
drop policy "cloud_story_scenario_versions_owner_read" on public.cloud_story_scenario_versions;
drop policy "cloud_story_scenario_versions_owner_insert" on public.cloud_story_scenario_versions;
create policy "cloud_story_scenario_versions_owner_read"
on public.cloud_story_scenario_versions for select
using (owner_profile_id = public.current_profile_id());
create policy "cloud_story_scenario_versions_owner_insert"
on public.cloud_story_scenario_versions for insert with check (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_story_proposal_selections selection
    join public.cloud_market_research_reports report on report.id = selection.research_report_id
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
alter table public.cloud_story_scenario_versions drop column content_class;
drop function public.set_cloud_adult_scenario_enabled(uuid, boolean);
drop function public.can_use_cloud_adult_scenario();
drop table public.cloud_adult_scenario_consents;
drop table public.cloud_adult_scenario_settings;
alter table public.cloud_adult_feature_grants
drop constraint cloud_adult_feature_grants_feature_key_check;
alter table public.cloud_adult_feature_grants
add constraint cloud_adult_feature_grants_feature_key_check
check (feature_key in ('adult_planning', 'adult_ai_planning'));
create or replace function public.can_use_cloud_adult_feature(p_feature_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    p_feature_key in ('adult_planning', 'adult_ai_planning')
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
