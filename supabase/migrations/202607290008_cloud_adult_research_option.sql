begin;

create table public.cloud_adult_research_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.cloud_adult_research_settings(singleton, enabled)
values (true, false);

create table public.cloud_adult_research_entitlements (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
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
  check (valid_until is null or valid_until > granted_at)
);

create table public.cloud_adult_research_consents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  age_confirmed_at timestamptz not null,
  terms_version text not null check (terms_version = 'adult-research-v1'),
  terms_accepted_at timestamptz not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cloud_adult_research_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (
    action in (
      'grant',
      'update',
      'suspend',
      'expire',
      'consent',
      'withdraw_consent',
      'enable_global',
      'disable_global'
    )
  ),
  target_profile_id uuid references public.profiles(id) on delete restrict,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index cloud_adult_research_audit_created_idx
on public.cloud_adult_research_audit_logs(created_at desc);

alter table public.cloud_adult_research_settings enable row level security;
alter table public.cloud_adult_research_entitlements enable row level security;
alter table public.cloud_adult_research_consents enable row level security;
alter table public.cloud_adult_research_audit_logs enable row level security;

grant select on public.cloud_adult_research_settings to authenticated;
grant select on public.cloud_adult_research_entitlements to authenticated;
grant select, insert, update on public.cloud_adult_research_consents to authenticated;
grant select, insert, update, delete on public.cloud_adult_research_settings to service_role;
grant select, insert, update, delete on public.cloud_adult_research_entitlements to service_role;
grant select, insert, update, delete on public.cloud_adult_research_consents to service_role;
grant select, insert on public.cloud_adult_research_audit_logs to service_role;

create policy "cloud_adult_research_settings_read"
on public.cloud_adult_research_settings
for select
using (true);

create policy "cloud_adult_research_entitlement_owner_read"
on public.cloud_adult_research_entitlements
for select
using (profile_id = public.current_profile_id() or public.is_admin());

create policy "cloud_adult_research_consent_owner_read"
on public.cloud_adult_research_consents
for select
using (profile_id = public.current_profile_id() or public.is_admin());

create policy "cloud_adult_research_consent_owner_insert"
on public.cloud_adult_research_consents
for insert
with check (
  profile_id = public.current_profile_id()
  and terms_version = 'adult-research-v1'
  and withdrawn_at is null
  and exists (
    select 1
    from public.cloud_adult_research_settings settings
    join public.cloud_adult_research_entitlements entitlement
      on entitlement.profile_id = public.current_profile_id()
    where settings.singleton
      and settings.enabled
      and entitlement.status = 'approved'
      and (
        entitlement.valid_until is null
        or entitlement.valid_until > now()
      )
  )
);

create policy "cloud_adult_research_consent_owner_update"
on public.cloud_adult_research_consents
for update
using (profile_id = public.current_profile_id())
with check (
  profile_id = public.current_profile_id()
  and terms_version = 'adult-research-v1'
  and (
    withdrawn_at is not null
    or exists (
      select 1
      from public.cloud_adult_research_settings settings
      join public.cloud_adult_research_entitlements entitlement
        on entitlement.profile_id = public.current_profile_id()
      where settings.singleton
        and settings.enabled
        and entitlement.status = 'approved'
        and (
          entitlement.valid_until is null
          or entitlement.valid_until > now()
        )
    )
  )
);

create policy "cloud_adult_research_audit_admin_read"
on public.cloud_adult_research_audit_logs
for select
using (public.is_admin());

create or replace function public.audit_cloud_adult_research_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cloud_adult_research_audit_logs (
    actor_profile_id,
    action,
    target_profile_id,
    before_value,
    after_value
  ) values (
    new.profile_id,
    case
      when new.withdrawn_at is null then 'consent'
      else 'withdraw_consent'
    end,
    new.profile_id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger cloud_adult_research_consent_audit
after insert or update on public.cloud_adult_research_consents
for each row execute function public.audit_cloud_adult_research_consent();

create or replace function public.set_cloud_adult_research_entitlement(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
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
  if auth.role() <> 'service_role' then
    raise exception 'cloud_adult_research_admin_required';
  end if;
  if not exists (
    select 1
    from public.profiles
    where id = p_actor_profile_id
      and role = 'admin'
  ) then
    raise exception 'cloud_adult_research_admin_required';
  end if;
  if p_status not in ('approved', 'suspended', 'expired')
     or p_source not in ('purchase', 'legacy_purchase', 'admin_grant', 'campaign')
     or char_length(coalesce(p_admin_note, '')) > 500 then
    raise exception 'cloud_adult_research_entitlement_invalid';
  end if;

  select to_jsonb(entitlement)
  into v_before
  from public.cloud_adult_research_entitlements entitlement
  where entitlement.profile_id = p_target_profile_id;

  insert into public.cloud_adult_research_entitlements (
    profile_id,
    status,
    source,
    granted_by_profile_id,
    valid_until,
    admin_note
  ) values (
    p_target_profile_id,
    p_status,
    p_source,
    p_actor_profile_id,
    p_valid_until,
    nullif(p_admin_note, '')
  )
  on conflict (profile_id) do update
  set status = excluded.status,
      source = excluded.source,
      granted_by_profile_id = excluded.granted_by_profile_id,
      valid_until = excluded.valid_until,
      admin_note = excluded.admin_note,
      updated_at = now();

  select to_jsonb(entitlement)
  into v_after
  from public.cloud_adult_research_entitlements entitlement
  where entitlement.profile_id = p_target_profile_id;

  v_action := case
    when p_status = 'suspended' then 'suspend'
    when p_status = 'expired' then 'expire'
    when v_before is null then 'grant'
    else 'update'
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

grant execute on function public.set_cloud_adult_research_entitlement(
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  text
) to service_role;

create or replace function public.set_cloud_adult_research_enabled(
  p_actor_profile_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if auth.role() <> 'service_role'
     or not exists (
       select 1
       from public.profiles
       where id = p_actor_profile_id
         and role = 'admin'
     ) then
    raise exception 'cloud_adult_research_admin_required';
  end if;

  select to_jsonb(settings)
  into v_before
  from public.cloud_adult_research_settings settings
  where settings.singleton;

  update public.cloud_adult_research_settings
  set enabled = p_enabled,
      updated_by_profile_id = p_actor_profile_id,
      updated_at = now()
  where singleton;

  select to_jsonb(settings)
  into v_after
  from public.cloud_adult_research_settings settings
  where settings.singleton;

  insert into public.cloud_adult_research_audit_logs (
    actor_profile_id,
    action,
    target_profile_id,
    before_value,
    after_value
  ) values (
    p_actor_profile_id,
    case when p_enabled then 'enable_global' else 'disable_global' end,
    null,
    v_before,
    v_after
  );
end;
$$;

grant execute on function public.set_cloud_adult_research_enabled(uuid, boolean)
to service_role;

create or replace function public.can_use_cloud_adult_research()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cloud_adult_research_settings settings
    join public.cloud_adult_research_entitlements entitlement
      on true
    join public.cloud_adult_research_consents consent
      on consent.profile_id = entitlement.profile_id
    where settings.singleton
      and settings.enabled
      and entitlement.profile_id = public.current_profile_id()
      and entitlement.status = 'approved'
      and (
        entitlement.valid_until is null
        or entitlement.valid_until > now()
      )
      and consent.terms_version = 'adult-research-v1'
      and consent.withdrawn_at is null
  );
$$;

grant execute on function public.can_use_cloud_adult_research() to authenticated;

drop policy if exists "cloud_market_research_owner_read"
on public.cloud_market_research_reports;

create policy "cloud_market_research_owner_read"
on public.cloud_market_research_reports
for select
using (
  owner_profile_id = public.current_profile_id()
  and (
    input->>'contentClass' = 'general'
    or (
      input->>'contentClass' = 'adult'
      and public.can_use_cloud_adult_research()
    )
  )
);

alter table public.cloud_market_research_reports
drop constraint if exists cloud_market_research_reports_input_check;

alter table public.cloud_market_research_reports
add constraint cloud_market_research_reports_input_check
check (
  jsonb_typeof(input) = 'object'
  and pg_column_size(input) <= 32768
  and input->>'contentClass' in ('general', 'adult')
);

drop policy if exists "cloud_market_research_owner_insert"
on public.cloud_market_research_reports;

create policy "cloud_market_research_owner_insert"
on public.cloud_market_research_reports
for insert
with check (
  owner_profile_id = public.current_profile_id()
  and status = 'completed'
  and (
    input->>'contentClass' = 'general'
    or (
      input->>'contentClass' = 'adult'
      and public.can_use_cloud_adult_research()
    )
  )
);

commit;
