begin;

create table public.cloud_adult_feature_grants (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null check (feature_key in ('adult_planning')),
  status text not null check (status in ('approved', 'suspended', 'expired')),
  source text not null check (
    source in ('purchase', 'legacy_purchase', 'admin_grant', 'campaign')
  ),
  granted_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  valid_until timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, feature_key),
  check (valid_until is null or valid_until > granted_at)
);

alter table public.cloud_adult_feature_grants enable row level security;

grant select on public.cloud_adult_feature_grants to authenticated;
grant select, insert, update, delete on public.cloud_adult_feature_grants to service_role;

create policy "cloud_adult_feature_grants_owner_read"
on public.cloud_adult_feature_grants
for select
using (profile_id = public.current_profile_id() or public.is_admin());

alter table public.cloud_adult_research_audit_logs
drop constraint if exists cloud_adult_research_audit_logs_action_check;

alter table public.cloud_adult_research_audit_logs
add constraint cloud_adult_research_audit_logs_action_check
check (
  action in (
    'grant',
    'update',
    'suspend',
    'expire',
    'consent',
    'withdraw_consent',
    'enable_global',
    'disable_global',
    'grant_feature',
    'update_feature',
    'suspend_feature',
    'expire_feature'
  )
);

create or replace function public.set_cloud_adult_feature_grant(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_feature_key text,
  p_status text,
  p_source text,
  p_valid_until timestamptz,
  p_admin_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  if auth.role() <> 'service_role'
     or not exists (
       select 1
       from public.profiles
       where id = p_actor_profile_id
         and role = 'admin'
     ) then
    raise exception 'cloud_adult_feature_admin_required';
  end if;
  if p_feature_key <> 'adult_planning'
     or p_status not in ('approved', 'suspended', 'expired')
     or p_source not in ('purchase', 'legacy_purchase', 'admin_grant', 'campaign')
     or char_length(coalesce(p_admin_note, '')) > 500 then
    raise exception 'cloud_adult_feature_grant_invalid';
  end if;

  select to_jsonb(feature_grant)
  into v_before
  from public.cloud_adult_feature_grants feature_grant
  where feature_grant.profile_id = p_target_profile_id
    and feature_grant.feature_key = p_feature_key;

  insert into public.cloud_adult_feature_grants (
    profile_id,
    feature_key,
    status,
    source,
    granted_by_profile_id,
    valid_until,
    admin_note
  ) values (
    p_target_profile_id,
    p_feature_key,
    p_status,
    p_source,
    p_actor_profile_id,
    p_valid_until,
    nullif(p_admin_note, '')
  )
  on conflict (profile_id, feature_key) do update
  set status = excluded.status,
      source = excluded.source,
      granted_by_profile_id = excluded.granted_by_profile_id,
      valid_until = excluded.valid_until,
      admin_note = excluded.admin_note,
      updated_at = now();

  select to_jsonb(feature_grant)
  into v_after
  from public.cloud_adult_feature_grants feature_grant
  where feature_grant.profile_id = p_target_profile_id
    and feature_grant.feature_key = p_feature_key;

  v_action := case
    when p_status = 'suspended' then 'suspend_feature'
    when p_status = 'expired' then 'expire_feature'
    when v_before is null then 'grant_feature'
    else 'update_feature'
  end;

  insert into public.cloud_adult_research_audit_logs (
    actor_profile_id,
    action,
    target_profile_id,
    before_value,
    after_value
  ) values (
    p_actor_profile_id,
    v_action,
    p_target_profile_id,
    v_before,
    v_after
  );
end;
$$;

grant execute on function public.set_cloud_adult_feature_grant(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz,
  text
) to service_role;

create or replace function public.can_use_cloud_adult_feature(
  p_feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_feature_key = 'adult_planning'
    and public.can_use_cloud_adult_research()
    and exists (
      select 1
      from public.cloud_adult_feature_grants feature_grant
      where feature_grant.profile_id = public.current_profile_id()
        and feature_grant.feature_key = p_feature_key
        and feature_grant.status = 'approved'
        and (
          feature_grant.valid_until is null
          or feature_grant.valid_until > now()
        )
    );
$$;

grant execute on function public.can_use_cloud_adult_feature(text)
to authenticated;

create table public.cloud_adult_planning_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,
  content_class text not null default 'adult' check (content_class = 'adult'),
  status text not null check (status in ('draft', 'ready')),
  working_title text not null check (char_length(working_title) between 1 and 200),
  concept text not null check (char_length(concept) between 1 and 2000),
  protagonist text not null check (char_length(protagonist) between 1 and 1000),
  protagonist_goal text not null check (char_length(protagonist_goal) between 1 and 1000),
  central_conflict text not null check (char_length(central_conflict) between 1 and 1000),
  reader_promise text not null check (char_length(reader_promise) between 1 and 1000),
  tone text not null check (char_length(tone) between 1 and 500),
  differentiation text not null check (char_length(differentiation) between 1 and 1500),
  ending_direction text not null check (char_length(ending_direction) between 1 and 1000),
  notes text not null default '' check (char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cloud_adult_planning_owner_created_idx
on public.cloud_adult_planning_briefs(owner_profile_id, created_at desc);

create index cloud_adult_planning_report_created_idx
on public.cloud_adult_planning_briefs(research_report_id, created_at desc);

alter table public.cloud_adult_planning_briefs enable row level security;

grant select, insert on public.cloud_adult_planning_briefs to authenticated;
grant select, insert, update, delete on public.cloud_adult_planning_briefs to service_role;

create policy "cloud_adult_planning_owner_read"
on public.cloud_adult_planning_briefs
for select
using (
  owner_profile_id = public.current_profile_id()
  and content_class = 'adult'
  and public.can_use_cloud_adult_feature('adult_planning')
  and exists (
    select 1
    from public.cloud_market_research_reports report
    where report.id = research_report_id
      and report.owner_profile_id = public.current_profile_id()
      and report.input->>'contentClass' = 'adult'
  )
);

create policy "cloud_adult_planning_owner_insert"
on public.cloud_adult_planning_briefs
for insert
with check (
  owner_profile_id = public.current_profile_id()
  and content_class = 'adult'
  and public.can_use_cloud_adult_feature('adult_planning')
  and exists (
    select 1
    from public.cloud_market_research_reports report
    where report.id = research_report_id
      and report.owner_profile_id = public.current_profile_id()
      and report.input->>'contentClass' = 'adult'
  )
);

commit;
