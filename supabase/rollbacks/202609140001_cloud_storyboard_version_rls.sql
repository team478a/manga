begin;

drop policy if exists "cloud_story_storyboard_versions_owner_insert"
  on public.cloud_story_storyboard_versions;

create policy "cloud_story_storyboard_versions_owner_insert"
on public.cloud_story_storyboard_versions for insert
with check (
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

commit;
