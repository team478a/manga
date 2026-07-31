begin;

do $$
begin
  if exists(select 1 from public.cloud_story_storyboard_versions where content_class='adult')
    or exists(select 1 from public.cloud_adult_storyboard_consents)
    or exists(select 1 from public.cloud_adult_feature_grants where feature_key='adult_storyboard')
  then raise exception 'adult_storyboard_data_exists'; end if;
end;
$$;

drop policy "cloud_story_storyboard_adoptions_owner_read" on public.cloud_story_storyboard_adoptions;
drop policy "cloud_story_storyboard_adoptions_owner_insert" on public.cloud_story_storyboard_adoptions;
create policy "cloud_story_storyboard_adoptions_owner_read"
on public.cloud_story_storyboard_adoptions for select
using(owner_profile_id=public.current_profile_id());
create policy "cloud_story_storyboard_adoptions_owner_insert"
on public.cloud_story_storyboard_adoptions for insert with check(
  owner_profile_id=public.current_profile_id()
  and exists(select 1 from public.cloud_story_storyboard_versions version
    where version.id=storyboard_version_id
      and version.owner_profile_id=public.current_profile_id()
      and version.scenario_version_id=scenario_version_id)
);

drop policy "cloud_story_storyboard_versions_owner_read" on public.cloud_story_storyboard_versions;
drop policy "cloud_story_storyboard_versions_owner_insert" on public.cloud_story_storyboard_versions;
create policy "cloud_story_storyboard_versions_owner_read"
on public.cloud_story_storyboard_versions for select
using(owner_profile_id=public.current_profile_id());
create policy "cloud_story_storyboard_versions_owner_insert"
on public.cloud_story_storyboard_versions for insert with check(
  owner_profile_id=public.current_profile_id()
  and exists(select 1 from public.cloud_story_scenario_versions scenario
    where scenario.id=scenario_version_id
      and scenario.owner_profile_id=public.current_profile_id()
      and scenario.content_class='general'
      and exists(select 1 from public.cloud_story_scenario_adoptions adoption
        where adoption.scenario_version_id=scenario.id
          and adoption.owner_profile_id=public.current_profile_id()
          and not exists(select 1 from public.cloud_story_scenario_adoptions newer
            where newer.proposal_selection_id=adoption.proposal_selection_id
              and(newer.adopted_at,newer.id)>(adoption.adopted_at,adoption.id))))
  and(parent_version_id is null or exists(select 1 from public.cloud_story_storyboard_versions parent
    where parent.id=parent_version_id
      and parent.owner_profile_id=public.current_profile_id()
      and parent.scenario_version_id=scenario_version_id))
);

alter table public.cloud_story_storyboard_versions drop column content_class;
drop function public.set_cloud_adult_storyboard_enabled(uuid,boolean);
drop function public.can_use_cloud_adult_storyboard();
drop table public.cloud_adult_storyboard_consents;
drop table public.cloud_adult_storyboard_settings;
alter table public.cloud_adult_feature_grants
drop constraint cloud_adult_feature_grants_feature_key_check;
alter table public.cloud_adult_feature_grants
add constraint cloud_adult_feature_grants_feature_key_check
check(feature_key in('adult_planning','adult_ai_planning','adult_scenario'));
create or replace function public.can_use_cloud_adult_feature(p_feature_key text)
returns boolean language sql stable security definer set search_path=public as $$
select p_feature_key in('adult_planning','adult_ai_planning','adult_scenario')
and public.can_use_cloud_adult_research()
and exists(select 1 from public.cloud_adult_feature_grants grant_record
  where grant_record.profile_id=public.current_profile_id()
    and grant_record.feature_key=p_feature_key
    and grant_record.status='approved'
    and(grant_record.valid_until is null or grant_record.valid_until>now()));
$$;
create or replace function public.set_cloud_adult_feature_grant(
  p_actor_profile_id uuid,p_target_profile_id uuid,p_feature_key text,p_status text,
  p_source text,p_valid_until timestamptz,p_admin_note text
) returns void language plpgsql security definer set search_path=public as $$
declare v_before jsonb;v_after jsonb;v_action text;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin')
  then raise exception 'cloud_adult_feature_admin_required';end if;
  if p_feature_key not in('adult_planning','adult_ai_planning','adult_scenario')
    or p_status not in('approved','suspended','expired')
    or p_source not in('purchase','legacy_purchase','admin_grant','campaign')
    or char_length(coalesce(p_admin_note,''))>500
  then raise exception 'cloud_adult_feature_grant_invalid';end if;
  select to_jsonb(g) into v_before from public.cloud_adult_feature_grants g where g.profile_id=p_target_profile_id and g.feature_key=p_feature_key;
  insert into public.cloud_adult_feature_grants(profile_id,feature_key,status,source,granted_by_profile_id,valid_until,admin_note)
  values(p_target_profile_id,p_feature_key,p_status,p_source,p_actor_profile_id,p_valid_until,nullif(p_admin_note,''))
  on conflict(profile_id,feature_key) do update set status=excluded.status,source=excluded.source,
    granted_by_profile_id=excluded.granted_by_profile_id,valid_until=excluded.valid_until,
    admin_note=excluded.admin_note,updated_at=now();
  select to_jsonb(g) into v_after from public.cloud_adult_feature_grants g where g.profile_id=p_target_profile_id and g.feature_key=p_feature_key;
  v_action:=case when p_status='suspended' then 'suspend_feature' when p_status='expired' then 'expire_feature'
    when v_before is null then 'grant_feature' else 'update_feature' end;
  insert into public.cloud_adult_research_audit_logs(actor_profile_id,action,target_profile_id,before_value,after_value)
  values(p_actor_profile_id,v_action,p_target_profile_id,v_before,v_after);
end;
$$;

commit;
