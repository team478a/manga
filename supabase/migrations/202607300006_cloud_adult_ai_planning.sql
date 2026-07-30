begin;

alter table public.cloud_adult_feature_grants
drop constraint cloud_adult_feature_grants_feature_key_check;
alter table public.cloud_adult_feature_grants
add constraint cloud_adult_feature_grants_feature_key_check
check (feature_key in ('adult_planning', 'adult_ai_planning'));

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
  if p_feature_key not in ('adult_planning', 'adult_ai_planning')
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

create table public.cloud_adult_ai_planning_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.cloud_adult_ai_planning_settings(singleton, enabled)
values (true, false);
alter table public.cloud_adult_ai_planning_settings enable row level security;
grant select on public.cloud_adult_ai_planning_settings to authenticated;
grant select, update on public.cloud_adult_ai_planning_settings to service_role;
create policy "cloud_adult_ai_planning_settings_read"
on public.cloud_adult_ai_planning_settings for select using (true);

create table public.cloud_adult_ai_planning_consents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  confirmed_18_plus boolean not null check (confirmed_18_plus),
  fictional_adults_only boolean not null check (fictional_adults_only),
  consensual_non_exploitative_only boolean not null check (consensual_non_exploitative_only),
  no_real_person boolean not null check (no_real_person),
  provider_disclosure_accepted boolean not null check (provider_disclosure_accepted),
  terms_version text not null check (terms_version = 'adult-ai-planning-v1'),
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.cloud_adult_ai_planning_consents enable row level security;
grant select, insert, update on public.cloud_adult_ai_planning_consents to authenticated;
grant select, insert, update, delete on public.cloud_adult_ai_planning_consents to service_role;
create policy "cloud_adult_ai_planning_consents_owner_read"
on public.cloud_adult_ai_planning_consents for select
using (profile_id = public.current_profile_id() or public.is_admin());
create policy "cloud_adult_ai_planning_consents_owner_insert"
on public.cloud_adult_ai_planning_consents for insert
with check (profile_id = public.current_profile_id());
create policy "cloud_adult_ai_planning_consents_owner_update"
on public.cloud_adult_ai_planning_consents for update
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

create or replace function public.can_use_cloud_adult_ai_planning()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.can_use_cloud_adult_feature('adult_ai_planning')
    and exists (
      select 1 from public.cloud_adult_ai_planning_settings settings
      where settings.singleton and settings.enabled
    )
    and exists (
      select 1 from public.cloud_adult_ai_planning_consents consent
      where consent.profile_id = public.current_profile_id()
        and consent.terms_version = 'adult-ai-planning-v1'
        and consent.revoked_at is null
        and consent.confirmed_18_plus
        and consent.fictional_adults_only
        and consent.consensual_non_exploitative_only
        and consent.no_real_person
        and consent.provider_disclosure_accepted
    );
$$;
grant execute on function public.can_use_cloud_adult_ai_planning() to authenticated;

create or replace function public.set_cloud_adult_ai_planning_enabled(
  p_actor_profile_id uuid,
  p_enabled boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' or not exists (
    select 1 from public.profiles where id = p_actor_profile_id and role = 'admin'
  ) then raise exception 'cloud_adult_ai_planning_admin_required'; end if;
  update public.cloud_adult_ai_planning_settings
  set enabled = p_enabled, updated_by_profile_id = p_actor_profile_id, updated_at = now()
  where singleton;
end;
$$;
grant execute on function public.set_cloud_adult_ai_planning_enabled(uuid, boolean)
to service_role;

alter table public.cloud_story_proposal_runs
add column content_class text not null default 'general'
check (content_class in ('general', 'adult'));
alter table public.cloud_story_proposal_selections
add column content_class text not null default 'general'
check (content_class in ('general', 'adult'));

drop policy "cloud_story_proposal_runs_owner_read" on public.cloud_story_proposal_runs;
drop policy "cloud_story_proposal_runs_owner_insert" on public.cloud_story_proposal_runs;
create policy "cloud_story_proposal_runs_owner_read"
on public.cloud_story_proposal_runs for select using (
  owner_profile_id = public.current_profile_id()
  and (content_class = 'general' or public.can_use_cloud_adult_ai_planning())
);
create policy "cloud_story_proposal_runs_owner_insert"
on public.cloud_story_proposal_runs for insert with check (
  owner_profile_id = public.current_profile_id()
  and (content_class = 'general' or public.can_use_cloud_adult_ai_planning())
  and exists (
    select 1 from public.cloud_market_research_reports report
    where report.id = research_report_id
      and report.owner_profile_id = public.current_profile_id()
      and report.status = 'completed'
      and report.input->>'contentClass' = content_class
  )
);

drop policy "cloud_story_proposal_selections_owner_read" on public.cloud_story_proposal_selections;
drop policy "cloud_story_proposal_selections_owner_insert" on public.cloud_story_proposal_selections;
create policy "cloud_story_proposal_selections_owner_read"
on public.cloud_story_proposal_selections for select using (
  owner_profile_id = public.current_profile_id()
  and (content_class = 'general' or public.can_use_cloud_adult_ai_planning())
);
create policy "cloud_story_proposal_selections_owner_insert"
on public.cloud_story_proposal_selections for insert with check (
  owner_profile_id = public.current_profile_id()
  and (content_class = 'general' or public.can_use_cloud_adult_ai_planning())
  and exists (
    select 1 from public.cloud_story_proposal_runs run
    where run.id = proposal_run_id
      and run.owner_profile_id = public.current_profile_id()
      and run.research_report_id = research_report_id
      and run.content_class = content_class
      and exists (
        select 1 from jsonb_array_elements(run.result->'candidates') candidate
        where candidate->>'id' = candidate_id and candidate = candidate_snapshot
      )
  )
);

commit;
