begin;

drop policy if exists "cloud_story_scenario_versions_owner_insert"
  on public.cloud_story_scenario_versions;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='cloud_story_scenario_versions'
      and column_name='content_class'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='cloud_story_proposal_selections'
      and column_name='content_class'
  ) and to_regprocedure('public.can_use_cloud_adult_scenario()') is not null then
    execute $policy$
      create policy "cloud_story_scenario_versions_owner_insert"
      on public.cloud_story_scenario_versions for insert
      with check (
        owner_profile_id = public.current_profile_id()
        and (content_class = 'general' or public.can_use_cloud_adult_scenario())
        and exists (
          select 1 from public.cloud_story_proposal_selections selection
          join public.cloud_market_research_reports report
            on report.id = selection.research_report_id
          where selection.id = proposal_selection_id
            and selection.owner_profile_id = public.current_profile_id()
            and selection.research_report_id = research_report_id
            and selection.content_class = content_class
            and report.owner_profile_id = public.current_profile_id()
            and report.input->>'contentClass' = content_class
        )
        and (
          parent_version_id is null
          or exists (
            select 1 from public.cloud_story_scenario_versions parent
            where parent.id = parent_version_id
              and parent.owner_profile_id = public.current_profile_id()
              and parent.proposal_selection_id = proposal_selection_id
              and parent.content_class = content_class
          )
        )
      )
    $policy$;
  else
    execute $policy$
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
      )
    $policy$;
  end if;
end $$;

commit;
