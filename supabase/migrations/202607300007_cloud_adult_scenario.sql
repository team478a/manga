begin;

alter table public.cloud_adult_feature_grants
drop constraint cloud_adult_feature_grants_feature_key_check;
alter table public.cloud_adult_feature_grants
add constraint cloud_adult_feature_grants_feature_key_check
check (feature_key in ('adult_planning', 'adult_ai_planning', 'adult_scenario'));

create or replace function public.set_cloud_adult_feature_grant(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_feature_key text,
  p_status text,
  p_source text,
  p_valid_until timestamptz,
  p_admin_note text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  if auth.role() <> 'service_role' or not exists (
    select 1 from public.profiles where id = p_actor_profile_id and role = 'admin'
  ) then raise exception 'cloud_adult_feature_admin_required'; end if;
  if p_feature_key not in ('adult_planning', 'adult_ai_planning', 'adult_scenario')
     or p_status not in ('approved', 'suspended', 'expired')
     or p_source not in ('purchase', 'legacy_purchase', 'admin_grant', 'campaign')
     or char_length(coalesce(p_admin_note, '')) > 500
  then raise exception 'cloud_adult_feature_grant_invalid'; end if;
  select to_jsonb(feature_grant) into v_before
  from public.cloud_adult_feature_grants feature_grant
  where feature_grant.profile_id = p_target_profile_id
    and feature_grant.feature_key = p_feature_key;
  insert into public.cloud_adult_feature_grants(
    profile_id, feature_key, status, source, granted_by_profile_id,
    valid_until, admin_note
  ) values (
    p_target_profile_id, p_feature_key, p_status, p_source,
    p_actor_profile_id, p_valid_until, nullif(p_admin_note, '')
  ) on conflict (profile_id, feature_key) do update set
    status = excluded.status,
    source = excluded.source,
    granted_by_profile_id = excluded.granted_by_profile_id,
    valid_until = excluded.valid_until,
    admin_note = excluded.admin_note,
    updated_at = now();
  select to_jsonb(feature_grant) into v_after
  from public.cloud_adult_feature_grants feature_grant
  where feature_grant.profile_id = p_target_profile_id
    and feature_grant.feature_key = p_feature_key;
  v_action := case
    when p_status = 'suspended' then 'suspend_feature'
    when p_status = 'expired' then 'expire_feature'
    when v_before is null then 'grant_feature'
    else 'update_feature'
  end;
  insert into public.cloud_adult_research_audit_logs(
    actor_profile_id, action, target_profile_id, before_value, after_value
  ) values (p_actor_profile_id, v_action, p_target_profile_id, v_before, v_after);
end;
$$;

create or replace function public.can_use_cloud_adult_feature(p_feature_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    p_feature_key in ('adult_planning', 'adult_ai_planning', 'adult_scenario')
    and public.can_use_cloud_adult_research()
    and exists (
      select 1 from public.cloud_adult_feature_grants feature_grant
      where feature_grant.profile_id = public.current_profile_id()
        and feature_grant.feature_key = p_feature_key
        and feature_grant.status = 'approved'
        and (feature_grant.valid_until is null or feature_grant.valid_until > now())
    );
$$;

create table public.cloud_adult_scenario_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.cloud_adult_scenario_settings(singleton, enabled)
values (true, false);
alter table public.cloud_adult_scenario_settings enable row level security;
grant select on public.cloud_adult_scenario_settings to authenticated;
grant select, update on public.cloud_adult_scenario_settings to service_role;
create policy "cloud_adult_scenario_settings_read"
on public.cloud_adult_scenario_settings for select using (true);

create table public.cloud_adult_scenario_consents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  confirmed_18_plus boolean not null check (confirmed_18_plus),
  fictional_adults_only boolean not null check (fictional_adults_only),
  consensual_non_exploitative_only boolean not null check (consensual_non_exploitative_only),
  no_real_person boolean not null check (no_real_person),
  provider_disclosure_accepted boolean not null check (provider_disclosure_accepted),
  terms_version text not null check (terms_version = 'adult-ai-scenario-v1'),
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.cloud_adult_scenario_consents enable row level security;
grant select, insert, update on public.cloud_adult_scenario_consents to authenticated;
grant select, insert, update, delete on public.cloud_adult_scenario_consents to service_role;
create policy "cloud_adult_scenario_consents_owner_read"
on public.cloud_adult_scenario_consents for select
using (profile_id = public.current_profile_id() or public.is_admin());
create policy "cloud_adult_scenario_consents_owner_insert"
on public.cloud_adult_scenario_consents for insert
with check (profile_id = public.current_profile_id());
create policy "cloud_adult_scenario_consents_owner_update"
on public.cloud_adult_scenario_consents for update
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

create or replace function public.can_use_cloud_adult_scenario()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.can_use_cloud_adult_ai_planning()
    and public.can_use_cloud_adult_feature('adult_scenario')
    and exists (
      select 1 from public.cloud_adult_scenario_settings settings
      where settings.singleton and settings.enabled
    )
    and exists (
      select 1 from public.cloud_adult_scenario_consents consent
      where consent.profile_id = public.current_profile_id()
        and consent.terms_version = 'adult-ai-scenario-v1'
        and consent.revoked_at is null
        and consent.confirmed_18_plus
        and consent.fictional_adults_only
        and consent.consensual_non_exploitative_only
        and consent.no_real_person
        and consent.provider_disclosure_accepted
    );
$$;
grant execute on function public.can_use_cloud_adult_scenario() to authenticated;

create or replace function public.set_cloud_adult_scenario_enabled(
  p_actor_profile_id uuid,
  p_enabled boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' or not exists (
    select 1 from public.profiles where id = p_actor_profile_id and role = 'admin'
  ) then raise exception 'cloud_adult_scenario_admin_required'; end if;
  update public.cloud_adult_scenario_settings
  set enabled = p_enabled, updated_by_profile_id = p_actor_profile_id, updated_at = now()
  where singleton;
end;
$$;
grant execute on function public.set_cloud_adult_scenario_enabled(uuid, boolean)
to service_role;

alter table public.cloud_story_scenario_versions
add column content_class text not null default 'general'
check (content_class in ('general', 'adult'));

drop policy "cloud_story_scenario_versions_owner_read" on public.cloud_story_scenario_versions;
drop policy "cloud_story_scenario_versions_owner_insert" on public.cloud_story_scenario_versions;
create policy "cloud_story_scenario_versions_owner_read"
on public.cloud_story_scenario_versions for select using (
  owner_profile_id = public.current_profile_id()
  and (content_class = 'general' or public.can_use_cloud_adult_scenario())
);
create policy "cloud_story_scenario_versions_owner_insert"
on public.cloud_story_scenario_versions for insert with check (
  owner_profile_id = public.current_profile_id()
  and (content_class = 'general' or public.can_use_cloud_adult_scenario())
  and exists (
    select 1 from public.cloud_story_proposal_selections selection
    join public.cloud_market_research_reports report
      on report.id = selection.research_report_id
    where selection.id = proposal_selection_id
      and selection.owner_profile_id = public.current_profile_id()
      and selection.research_report_id = research_report_id
      and selection.content_class = cloud_story_scenario_versions.content_class
      and report.owner_profile_id = public.current_profile_id()
      and report.input->>'contentClass' = cloud_story_scenario_versions.content_class
  )
  and (
    parent_version_id is null
    or exists (
      select 1 from public.cloud_story_scenario_versions parent
      where parent.id = parent_version_id
        and parent.owner_profile_id = public.current_profile_id()
        and parent.proposal_selection_id = proposal_selection_id
        and parent.content_class = cloud_story_scenario_versions.content_class
    )
  )
);

drop policy "cloud_story_scenario_adoptions_owner_read" on public.cloud_story_scenario_adoptions;
drop policy "cloud_story_scenario_adoptions_owner_insert" on public.cloud_story_scenario_adoptions;
create policy "cloud_story_scenario_adoptions_owner_read"
on public.cloud_story_scenario_adoptions for select using (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_story_scenario_versions version
    where version.id = scenario_version_id
      and (version.content_class = 'general' or public.can_use_cloud_adult_scenario())
  )
);
create policy "cloud_story_scenario_adoptions_owner_insert"
on public.cloud_story_scenario_adoptions for insert with check (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_story_scenario_versions version
    where version.id = scenario_version_id
      and version.owner_profile_id = public.current_profile_id()
      and version.proposal_selection_id = proposal_selection_id
      and (version.content_class = 'general' or public.can_use_cloud_adult_scenario())
  )
);

drop policy "cloud_story_storyboard_versions_owner_insert"
on public.cloud_story_storyboard_versions;
create policy "cloud_story_storyboard_versions_owner_insert"
on public.cloud_story_storyboard_versions for insert with check (
  owner_profile_id = public.current_profile_id()
  and exists (
    select 1 from public.cloud_story_scenario_versions scenario
    where scenario.id = scenario_version_id
      and scenario.owner_profile_id = public.current_profile_id()
      and scenario.content_class = 'general'
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
