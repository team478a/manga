create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text,
  avatar_url text,
  role text not null default 'creator' check (role in ('buyer', 'creator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  sample_image_urls text[] not null default '{}',
  source_project_id uuid,
  content_class text not null default 'general' check (content_class in ('general', 'adult')),
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.works
add column if not exists sample_image_urls text[] not null default '{}';

alter table public.works
add column if not exists source_project_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'content_class'
  ) then
    alter table public.works
    add column content_class text not null default 'adult';

    update public.works
    set content_class = case
      when tags && array['全年齢','12歳以上','15歳以上']::text[] then 'general'
      else 'adult'
    end;
  end if;
end
$$;

alter table public.works
drop constraint if exists works_content_class_check;

alter table public.works
add constraint works_content_class_check
check (content_class in ('general', 'adult'));

alter table public.works
alter column content_class set default 'general';

create index if not exists works_source_project_id_idx
on public.works (source_project_id)
where source_project_id is not null;

create index if not exists works_general_public_idx
on public.works (is_public, status, created_at desc)
where content_class = 'general';

create table if not exists public.digital_products (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  file_url text,
  price integer not null check (price >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goods_requests (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  product_type text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'in_progress', 'completed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_email text not null,
  product_id uuid not null references public.digital_products(id),
  creator_id uuid not null references public.profiles(id),
  amount integer not null check (amount >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  creator_revenue integer not null default 0 check (creator_revenue >= 0),
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.desktop_device_authorizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  device_name text not null check (char_length(device_name) between 1 and 100),
  secret_hash text not null unique,
  user_code text not null unique,
  scopes text[] not null default array['works:read']::text[],
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired', 'revoked')),
  expires_at timestamptz not null,
  token_expires_at timestamptz,
  approved_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desktop_device_authorizations_profile_idx
on public.desktop_device_authorizations (profile_id, status);

create index if not exists desktop_device_authorizations_expiry_idx
on public.desktop_device_authorizations (status, expires_at);

create table if not exists public.desktop_device_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_desktop_device_rate_limit(
  p_key_hash text,
  p_request_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.desktop_device_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if char_length(p_key_hash) < 16 or p_request_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid desktop device rate limit input';
  end if;

  insert into public.desktop_device_rate_limits (key_hash, request_count, window_started_at, updated_at)
  values (p_key_hash, 0, v_now, v_now)
  on conflict (key_hash) do nothing;

  select * into v_row
  from public.desktop_device_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return false;
  end if;

  if v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) then
    update public.desktop_device_rate_limits
    set window_started_at = v_now,
        request_count = 1,
        blocked_until = null,
        updated_at = v_now
    where key_hash = p_key_hash;
    return true;
  end if;

  if v_row.request_count >= p_request_limit then
    update public.desktop_device_rate_limits
    set blocked_until = v_now + make_interval(secs => p_window_seconds),
        updated_at = v_now
    where key_hash = p_key_hash;
    return false;
  end if;

  update public.desktop_device_rate_limits
  set request_count = request_count + 1,
      updated_at = v_now
  where key_hash = p_key_hash;
  return true;
end;
$$;

create or replace function public.cleanup_desktop_device_authorizations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.desktop_device_authorizations
  where (
    status in ('pending', 'denied', 'expired')
    and expires_at < now() - interval '1 day'
  ) or (
    status = 'revoked'
    and coalesce(revoked_at, updated_at) < now() - interval '30 days'
  ) or (
    status = 'approved'
    and token_expires_at < now() - interval '30 days'
  );
  get diagnostics v_deleted = row_count;

  delete from public.desktop_device_rate_limits
  where updated_at < now() - interval '1 day';

  return v_deleted;
end;
$$;

revoke execute on function public.consume_desktop_device_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_desktop_device_rate_limit(text, integer, integer) to service_role;
revoke execute on function public.cleanup_desktop_device_authorizations() from public, anon, authenticated;
grant execute on function public.cleanup_desktop_device_authorizations() to service_role;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists works_touch_updated_at on public.works;
create trigger works_touch_updated_at before update on public.works
for each row execute function public.touch_updated_at();

drop trigger if exists digital_products_touch_updated_at on public.digital_products;
create trigger digital_products_touch_updated_at before update on public.digital_products
for each row execute function public.touch_updated_at();

drop trigger if exists goods_requests_touch_updated_at on public.goods_requests;
create trigger goods_requests_touch_updated_at before update on public.goods_requests
for each row execute function public.touch_updated_at();

drop trigger if exists desktop_device_authorizations_touch_updated_at on public.desktop_device_authorizations;
create trigger desktop_device_authorizations_touch_updated_at before update on public.desktop_device_authorizations
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Creator'),
    'creator'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_profile_id()
returns uuid language sql stable as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create table if not exists public.cloud_adult_research_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.cloud_adult_research_settings(singleton, enabled)
values (true, false)
on conflict (singleton) do nothing;

create table if not exists public.cloud_adult_research_entitlements (
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

create table if not exists public.cloud_adult_research_consents (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  age_confirmed_at timestamptz not null,
  terms_version text not null check (terms_version = 'adult-research-v1'),
  terms_accepted_at timestamptz not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_adult_research_audit_logs (
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
      'disable_global',
      'grant_feature',
      'update_feature',
      'suspend_feature',
      'expire_feature'
    )
  ),
  target_profile_id uuid references public.profiles(id) on delete restrict,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cloud_adult_research_audit_created_idx
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

drop policy if exists "cloud_adult_research_settings_read"
on public.cloud_adult_research_settings;
create policy "cloud_adult_research_settings_read"
on public.cloud_adult_research_settings
for select
using (true);

drop policy if exists "cloud_adult_research_entitlement_owner_read"
on public.cloud_adult_research_entitlements;
create policy "cloud_adult_research_entitlement_owner_read"
on public.cloud_adult_research_entitlements
for select
using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "cloud_adult_research_consent_owner_read"
on public.cloud_adult_research_consents;
create policy "cloud_adult_research_consent_owner_read"
on public.cloud_adult_research_consents
for select
using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "cloud_adult_research_consent_owner_insert"
on public.cloud_adult_research_consents;
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

drop policy if exists "cloud_adult_research_consent_owner_update"
on public.cloud_adult_research_consents;
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

drop policy if exists "cloud_adult_research_audit_admin_read"
on public.cloud_adult_research_audit_logs;
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

drop trigger if exists cloud_adult_research_consent_audit
on public.cloud_adult_research_consents;
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

create table if not exists public.cloud_adult_feature_grants (
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

drop policy if exists "cloud_adult_feature_grants_owner_read"
on public.cloud_adult_feature_grants;
create policy "cloud_adult_feature_grants_owner_read"
on public.cloud_adult_feature_grants
for select
using (profile_id = public.current_profile_id() or public.is_admin());

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
       select 1 from public.profiles
       where id = p_actor_profile_id and role = 'admin'
     ) then
    raise exception 'cloud_adult_feature_admin_required';
  end if;
  if p_feature_key <> 'adult_planning'
     or p_status not in ('approved', 'suspended', 'expired')
     or p_source not in ('purchase', 'legacy_purchase', 'admin_grant', 'campaign')
     or char_length(coalesce(p_admin_note, '')) > 500 then
    raise exception 'cloud_adult_feature_grant_invalid';
  end if;

  select to_jsonb(feature_grant) into v_before
  from public.cloud_adult_feature_grants feature_grant
  where feature_grant.profile_id = p_target_profile_id
    and feature_grant.feature_key = p_feature_key;

  insert into public.cloud_adult_feature_grants (
    profile_id, feature_key, status, source, granted_by_profile_id,
    valid_until, admin_note
  ) values (
    p_target_profile_id, p_feature_key, p_status, p_source,
    p_actor_profile_id, p_valid_until, nullif(p_admin_note, '')
  )
  on conflict (profile_id, feature_key) do update
  set status = excluded.status,
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

  insert into public.cloud_adult_research_audit_logs (
    actor_profile_id, action, target_profile_id, before_value, after_value
  ) values (
    p_actor_profile_id, v_action, p_target_profile_id, v_before, v_after
  );
end;
$$;

grant execute on function public.set_cloud_adult_feature_grant(
  uuid, uuid, text, text, text, timestamptz, text
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

create table if not exists public.cloud_market_research_reports (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status = 'completed'),
  input jsonb not null check (
    jsonb_typeof(input) = 'object'
    and pg_column_size(input) <= 32768
    and input->>'contentClass' in ('general', 'adult')
  ),
  sources jsonb not null check (
    jsonb_typeof(sources) = 'array'
    and jsonb_array_length(sources) between 1 and 5
    and pg_column_size(sources) <= 65536
  ),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result->>'containsGeneratedMarketNumbers' = 'false'
    and pg_column_size(result) <= 131072
  ),
  engine_version text not null check (engine_version in ('research-rules-v1', 'research-rules-v2', 'openai-web-research-v1')),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists cloud_market_research_owner_idx
on public.cloud_market_research_reports(owner_profile_id, created_at desc);

alter table public.cloud_market_research_reports enable row level security;

grant select, insert on public.cloud_market_research_reports to authenticated;
grant select, insert, delete on public.cloud_market_research_reports to service_role;

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

create table if not exists public.cloud_adult_planning_briefs (
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

create index if not exists cloud_adult_planning_owner_created_idx
on public.cloud_adult_planning_briefs(owner_profile_id, created_at desc);
create index if not exists cloud_adult_planning_report_created_idx
on public.cloud_adult_planning_briefs(research_report_id, created_at desc);

alter table public.cloud_adult_planning_briefs enable row level security;
grant select, insert on public.cloud_adult_planning_briefs to authenticated;
grant select, insert, update, delete on public.cloud_adult_planning_briefs to service_role;

drop policy if exists "cloud_adult_planning_owner_read"
on public.cloud_adult_planning_briefs;
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

drop policy if exists "cloud_adult_planning_owner_insert"
on public.cloud_adult_planning_briefs;
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

alter table public.profiles enable row level security;
alter table public.works enable row level security;
alter table public.digital_products enable row level security;
alter table public.goods_requests enable row level security;
alter table public.orders enable row level security;
alter table public.desktop_device_authorizations enable row level security;
alter table public.desktop_device_rate_limits enable row level security;

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

create policy "profiles_read_own_or_admin" on public.profiles
for select using (user_id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
for update using (user_id = auth.uid()) with check (user_id = auth.uid() and role <> 'admin');

create policy "profiles_admin_all" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "works_public_read" on public.works;
drop policy if exists "works_creator_insert" on public.works;
drop policy if exists "works_creator_update" on public.works;
drop policy if exists "works_creator_delete" on public.works;

create policy "works_public_read" on public.works
for select using (
  (content_class = 'general' and is_public = true)
  or creator_id = public.current_profile_id()
  or public.is_admin()
);

create policy "works_creator_insert" on public.works
for insert with check (
  creator_id = public.current_profile_id()
  and content_class = 'general'
);

create policy "works_creator_update" on public.works
for update using (creator_id = public.current_profile_id() or public.is_admin())
with check (
  public.is_admin()
  or (
    creator_id = public.current_profile_id()
    and content_class = 'general'
  )
);

create policy "works_creator_delete" on public.works
for delete using (creator_id = public.current_profile_id() or public.is_admin());

drop policy if exists "products_public_read_active" on public.digital_products;
drop policy if exists "products_creator_insert" on public.digital_products;
drop policy if exists "products_creator_update" on public.digital_products;

create policy "products_public_read_active" on public.digital_products
for select using (
  creator_id = public.current_profile_id()
  or public.is_admin()
  or (
    status = 'active'
    and exists (
      select 1 from public.works
      where works.id = digital_products.work_id
        and works.content_class = 'general'
        and works.is_public = true
    )
  )
);

create policy "products_creator_insert" on public.digital_products
for insert with check (
  creator_id = public.current_profile_id()
  and exists (
    select 1 from public.works
    where works.id = digital_products.work_id
      and works.creator_id = public.current_profile_id()
      and works.content_class = 'general'
  )
);

create policy "products_creator_update" on public.digital_products
for update using (creator_id = public.current_profile_id() or public.is_admin())
with check (
  public.is_admin()
  or (
    creator_id = public.current_profile_id()
    and exists (
      select 1 from public.works
      where works.id = digital_products.work_id
        and works.creator_id = public.current_profile_id()
        and works.content_class = 'general'
    )
  )
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'goods_requests_status_check'
      and conrelid = 'public.goods_requests'::regclass
  ) then
    alter table public.goods_requests drop constraint goods_requests_status_check;
  end if;
end $$;

update public.goods_requests set status = 'in_progress' where status = 'reviewing';
update public.goods_requests set status = 'completed' where status = 'fulfilled';

alter table public.goods_requests
add constraint goods_requests_status_check
check (status in ('pending', 'approved', 'rejected', 'in_progress', 'completed'));

drop policy if exists "goods_requests_creator_read" on public.goods_requests;
drop policy if exists "goods_requests_creator_insert" on public.goods_requests;
drop policy if exists "goods_requests_creator_update" on public.goods_requests;
drop policy if exists "goods_requests_admin_update" on public.goods_requests;

create policy "goods_requests_creator_read" on public.goods_requests
for select using (creator_id = public.current_profile_id() or public.is_admin());

create policy "goods_requests_creator_insert" on public.goods_requests
for insert with check (
  creator_id = public.current_profile_id()
  and status = 'pending'
  and exists (
    select 1 from public.works
    where works.id = goods_requests.work_id
      and works.creator_id = public.current_profile_id()
      and works.content_class = 'general'
  )
);

create policy "goods_requests_admin_update" on public.goods_requests
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "orders_creator_or_admin_read" on public.orders;
drop policy if exists "orders_admin_all" on public.orders;
drop policy if exists "orders_public_pending_insert" on public.orders;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders drop constraint orders_status_check;
  end if;
end $$;

alter table public.orders
add constraint orders_status_check
check (status in ('pending', 'paid', 'failed', 'refunded', 'canceled'));

create policy "orders_creator_or_admin_read" on public.orders
for select using (creator_id = public.current_profile_id() or public.is_admin());

create policy "orders_public_pending_insert" on public.orders
for insert with check (
  status = 'pending'
  and amount >= 0
  and platform_fee = floor(amount * 0.2)::integer
  and creator_revenue = amount - platform_fee
  and exists (
    select 1
    from public.digital_products
    join public.works on works.id = digital_products.work_id
    where digital_products.id = orders.product_id
      and digital_products.creator_id = orders.creator_id
      and digital_products.price = orders.amount
      and digital_products.status = 'active'
      and works.is_public = true
      and works.content_class = 'general'
  )
);

create policy "orders_admin_all" on public.orders
for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'works',
  'works',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-products',
  'digital-products',
  false,
  52428800,
  array['application/pdf', 'image/png', 'image/jpeg', 'application/zip', 'application/x-zip-compressed']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "work_images_public_read" on storage.objects;
drop policy if exists "work_images_creator_upload" on storage.objects;
drop policy if exists "works_public_read" on storage.objects;
create policy "works_public_read" on storage.objects
for select using (bucket_id = 'works');

drop policy if exists "works_creator_upload" on storage.objects;
create policy "works_creator_upload" on storage.objects
for insert with check (
  bucket_id = 'works'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "works_creator_update" on storage.objects;
create policy "works_creator_update" on storage.objects
for update using (
  bucket_id = 'works'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'works'
  and owner_id = auth.uid()::text
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = 'general'
  )
);

drop policy if exists "works_creator_delete" on storage.objects;
create policy "works_creator_delete" on storage.objects
for delete using (
  bucket_id = 'works'
  and owner_id = auth.uid()::text
);

drop policy if exists "digital_products_creator_upload" on storage.objects;
create policy "digital_products_creator_upload" on storage.objects
for insert with check (
  bucket_id = 'digital-products'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "digital_products_creator_update" on storage.objects;
create policy "digital_products_creator_update" on storage.objects
for update using (
  bucket_id = 'digital-products'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'digital-products'
  and owner_id = auth.uid()::text
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (storage.foldername(name))[1] = 'general'
  )
);

drop policy if exists "digital_products_creator_delete" on storage.objects;
create policy "digital_products_creator_delete" on storage.objects
for delete using (
  bucket_id = 'digital-products'
  and owner_id = auth.uid()::text
);

-- Cloud Creator Phase 1 foundation. Keep this section idempotent.
create table if not exists public.cloud_projects (
  id uuid primary key default gen_random_uuid(), owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_surface text not null default 'cloud' check (source_surface in ('cloud','desktop')), source_project_id uuid,
  content_class text not null default 'general' check (content_class = 'general'), title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000), age_rating text not null default '全年齢' check (age_rating in ('全年齢','12歳以上','15歳以上')),
  reading_direction text not null default 'rtl' check (reading_direction in ('rtl','ltr')), width integer not null default 1600 check (width between 100 and 20000),
  height integer not null default 2400 check (height between 100 and 20000), dpi integer not null default 300 check (dpi between 72 and 1200),
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')), revision bigint not null default 0 check (revision >= 0),
  storage_bytes bigint not null default 0 check (storage_bytes between 0 and 2147483648), deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_profile_id, source_project_id)
);
create table if not exists public.cloud_project_collaborators (
  project_id uuid not null references public.cloud_projects(id) on delete cascade, invitee_profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('viewer','editor')), status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_at timestamptz not null default now(), accepted_at timestamptz, primary key(project_id, invitee_profile_id)
);
create table if not exists public.cloud_episodes (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.cloud_projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200), order_index integer not null check (order_index >= 0),
  revision bigint not null default 0 check (revision >= 0), deleted_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(project_id, order_index), unique(id, project_id)
);
create table if not exists public.cloud_pages (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.cloud_projects(id) on delete cascade,
  episode_id uuid not null, page_number integer not null check (page_number >= 1),
  order_index integer not null check (order_index >= 0), width integer not null check (width between 100 and 20000),
  height integer not null check (height between 100 and 20000), background_color text not null default '#ffffff' check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  revision bigint not null default 0 check (revision >= 0), deleted_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(episode_id, order_index), unique(id, project_id),
  foreign key(episode_id, project_id) references public.cloud_episodes(id, project_id) on delete cascade
);
create table if not exists public.cloud_assets (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade, storage_path text not null unique check (char_length(storage_path) between 1 and 700),
  file_name text not null check (char_length(file_name) between 1 and 255), mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 20971520), width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000), sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'), deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id, sha256)
);
create table if not exists public.cloud_canvas_snapshots (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.cloud_projects(id) on delete cascade,
  page_id uuid not null, revision bigint not null check (revision >= 0),
  canvas jsonb not null check (jsonb_typeof(canvas) = 'object'), created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), unique(page_id, revision),
  foreign key(page_id, project_id) references public.cloud_pages(id, project_id) on delete cascade
);
create table if not exists public.cloud_project_versions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.cloud_projects(id) on delete cascade,
  revision bigint not null check (revision >= 0), manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(), unique(project_id, revision)
);

create index if not exists cloud_projects_owner_active_idx on public.cloud_projects(owner_profile_id, updated_at desc) where deleted_at is null;
create index if not exists cloud_projects_public_idx on public.cloud_projects(updated_at desc) where visibility = 'public' and deleted_at is null;
create index if not exists cloud_collaborators_invitee_idx on public.cloud_project_collaborators(invitee_profile_id, status);
create index if not exists cloud_episodes_project_idx on public.cloud_episodes(project_id, order_index) where deleted_at is null;
create index if not exists cloud_pages_project_idx on public.cloud_pages(project_id, episode_id, order_index) where deleted_at is null;
create index if not exists cloud_assets_project_idx on public.cloud_assets(project_id, created_at) where deleted_at is null;
create index if not exists cloud_snapshots_page_idx on public.cloud_canvas_snapshots(page_id, revision desc);
create index if not exists cloud_versions_project_idx on public.cloud_project_versions(project_id, revision desc);

create or replace function public.protect_cloud_project_boundary() returns trigger language plpgsql set search_path=public as $$
begin if new.owner_profile_id<>old.owner_profile_id or new.content_class<>old.content_class or new.source_surface<>old.source_surface
or new.source_project_id is distinct from old.source_project_id then raise exception 'cloud_project_boundary_is_immutable'; end if; return new; end $$;
drop trigger if exists cloud_projects_boundary_guard on public.cloud_projects;
create trigger cloud_projects_boundary_guard before update on public.cloud_projects for each row execute function public.protect_cloud_project_boundary();

create or replace function public.cloud_project_can_read(p_project_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.cloud_projects project where project.id=p_project_id and project.content_class='general' and (
    public.is_admin() or project.owner_profile_id=public.current_profile_id() or (project.deleted_at is null and (project.visibility in ('public','unlisted')
    or exists(select 1 from public.cloud_project_collaborators collaborator where collaborator.project_id=project.id and collaborator.invitee_profile_id=public.current_profile_id() and collaborator.status='accepted')))))
$$;
create or replace function public.cloud_project_can_edit(p_project_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.cloud_projects project where project.id=p_project_id and project.content_class='general' and project.deleted_at is null and (
    public.is_admin() or project.owner_profile_id=public.current_profile_id() or exists(select 1 from public.cloud_project_collaborators collaborator
    where collaborator.project_id=project.id and collaborator.invitee_profile_id=public.current_profile_id() and collaborator.status='accepted' and collaborator.role='editor')))
$$;

alter table public.cloud_projects enable row level security;
alter table public.cloud_project_collaborators enable row level security;
alter table public.cloud_episodes enable row level security;
alter table public.cloud_pages enable row level security;
alter table public.cloud_assets enable row level security;
alter table public.cloud_canvas_snapshots enable row level security;
alter table public.cloud_project_versions enable row level security;

grant select on public.cloud_projects, public.cloud_project_collaborators,
  public.cloud_episodes, public.cloud_pages, public.cloud_assets,
  public.cloud_canvas_snapshots, public.cloud_project_versions to anon, authenticated;
grant insert, update, delete on public.cloud_projects, public.cloud_project_collaborators,
  public.cloud_episodes, public.cloud_pages, public.cloud_assets to authenticated;
grant insert on public.cloud_canvas_snapshots, public.cloud_project_versions to authenticated;

drop policy if exists "cloud_projects_read" on public.cloud_projects;
drop policy if exists "cloud_projects_insert" on public.cloud_projects;
drop policy if exists "cloud_projects_update" on public.cloud_projects;
drop policy if exists "cloud_projects_delete" on public.cloud_projects;
create policy "cloud_projects_read" on public.cloud_projects for select using (public.cloud_project_can_read(id));
create policy "cloud_projects_insert" on public.cloud_projects for insert with check (owner_profile_id=public.current_profile_id() and content_class='general');
create policy "cloud_projects_update" on public.cloud_projects for update using (public.cloud_project_can_edit(id) or owner_profile_id=public.current_profile_id() or public.is_admin())
with check (content_class='general' and (public.cloud_project_can_edit(id) or owner_profile_id=public.current_profile_id() or public.is_admin()));
create policy "cloud_projects_delete" on public.cloud_projects for delete using (owner_profile_id=public.current_profile_id() or public.is_admin());

drop policy if exists "cloud_collaborators_read" on public.cloud_project_collaborators;
drop policy if exists "cloud_collaborators_owner_write" on public.cloud_project_collaborators;
create policy "cloud_collaborators_read" on public.cloud_project_collaborators for select using (public.cloud_project_can_read(project_id) or invitee_profile_id=public.current_profile_id());
create policy "cloud_collaborators_owner_write" on public.cloud_project_collaborators for all
using (exists(select 1 from public.cloud_projects where id=project_id and (owner_profile_id=public.current_profile_id() or public.is_admin())))
with check (exists(select 1 from public.cloud_projects where id=project_id and (owner_profile_id=public.current_profile_id() or public.is_admin())));

drop policy if exists "cloud_episodes_read" on public.cloud_episodes; drop policy if exists "cloud_episodes_write" on public.cloud_episodes;
drop policy if exists "cloud_pages_read" on public.cloud_pages; drop policy if exists "cloud_pages_write" on public.cloud_pages;
drop policy if exists "cloud_assets_read" on public.cloud_assets; drop policy if exists "cloud_assets_write" on public.cloud_assets;
drop policy if exists "cloud_snapshots_read" on public.cloud_canvas_snapshots; drop policy if exists "cloud_snapshots_insert" on public.cloud_canvas_snapshots;
drop policy if exists "cloud_versions_read" on public.cloud_project_versions; drop policy if exists "cloud_versions_insert" on public.cloud_project_versions;
create policy "cloud_episodes_read" on public.cloud_episodes for select using (public.cloud_project_can_read(project_id));
create policy "cloud_episodes_write" on public.cloud_episodes for all using (public.cloud_project_can_edit(project_id)) with check (public.cloud_project_can_edit(project_id));
create policy "cloud_pages_read" on public.cloud_pages for select using (public.cloud_project_can_read(project_id));
create policy "cloud_pages_write" on public.cloud_pages for all using (public.cloud_project_can_edit(project_id)) with check (public.cloud_project_can_edit(project_id));
create policy "cloud_assets_read" on public.cloud_assets for select using (public.cloud_project_can_read(project_id));
create policy "cloud_assets_write" on public.cloud_assets for all using (public.cloud_project_can_edit(project_id)) with check (owner_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));
create policy "cloud_snapshots_read" on public.cloud_canvas_snapshots for select using (public.cloud_project_can_read(project_id));
create policy "cloud_snapshots_insert" on public.cloud_canvas_snapshots for insert with check (created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));
create policy "cloud_versions_read" on public.cloud_project_versions for select using (public.cloud_project_can_read(project_id));
create policy "cloud_versions_insert" on public.cloud_project_versions for insert with check (created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));

create or replace function public.refresh_cloud_project_storage() returns trigger language plpgsql security definer set search_path=public as $$
declare v_project_id uuid:=coalesce(new.project_id,old.project_id); v_total bigint;
begin select coalesce(sum(byte_size),0) into v_total from public.cloud_assets where project_id=v_project_id and deleted_at is null;
if v_total>2147483648 then raise exception 'cloud_project_storage_limit'; end if;
update public.cloud_projects set storage_bytes=v_total,updated_at=now() where id=v_project_id;
if tg_op='DELETE' then return old; end if; return new; end $$;
drop trigger if exists cloud_assets_storage_total on public.cloud_assets;
create trigger cloud_assets_storage_total after insert or update or delete on public.cloud_assets for each row execute function public.refresh_cloud_project_storage();

create or replace function public.save_cloud_page_snapshot(p_page_id uuid,p_expected_revision bigint,p_canvas jsonb)
returns table(page_id uuid,revision bigint,updated_at timestamptz) language plpgsql security invoker set search_path=public as $$
declare v_page public.cloud_pages%rowtype; v_profile_id uuid:=public.current_profile_id(); v_project_revision bigint; v_now timestamptz:=clock_timestamp();
begin if v_profile_id is null or jsonb_typeof(p_canvas)<>'object' or pg_column_size(p_canvas)>2097152 then raise exception 'invalid_snapshot_input'; end if;
select * into v_page from public.cloud_pages where id=p_page_id for update;
if not found or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'page_not_found'; end if;
if v_page.revision<>p_expected_revision then raise exception 'revision_conflict:%',v_page.revision; end if;
update public.cloud_pages set revision=cloud_pages.revision+1,updated_at=v_now where id=p_page_id returning cloud_pages.revision into revision;
insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id,created_at) values(v_page.project_id,p_page_id,revision,p_canvas,v_profile_id,v_now);
update public.cloud_projects set revision=cloud_projects.revision+1,updated_at=v_now where id=v_page.project_id returning cloud_projects.revision into v_project_revision;
insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id,created_at) values(v_page.project_id,v_project_revision,jsonb_build_object('event','page_snapshot','pageId',p_page_id,'pageRevision',revision),v_profile_id,v_now);
page_id:=p_page_id; updated_at:=v_now; return next; end $$;
create or replace function public.soft_delete_cloud_project(p_project_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
begin update public.cloud_projects set deleted_at=now(),updated_at=now() where id=p_project_id and deleted_at is null and (owner_profile_id=public.current_profile_id() or public.is_admin());
if not found then raise exception 'cloud_project_not_found'; end if; return p_project_id; end $$;
create or replace function public.restore_cloud_project(p_project_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
begin update public.cloud_projects set deleted_at=null,updated_at=now() where id=p_project_id and deleted_at>=now()-interval '30 days' and (owner_profile_id=public.current_profile_id() or public.is_admin());
if not found then raise exception 'cloud_project_restore_unavailable'; end if; return p_project_id; end $$;
create or replace function public.import_cloud_project(p_manifest jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id(); v_project_id uuid:=gen_random_uuid(); v_episode jsonb; v_page jsonb; v_snapshot jsonb;
begin if v_profile_id is null or pg_column_size(p_manifest)>10485760 or p_manifest->>'format'<>'mangai.cloud-project' or p_manifest->>'version'<>'1' or p_manifest->>'policyVersion'<>'1'
or p_manifest->>'createdBySurface'<>'desktop' or p_manifest->'project'->>'contentClass'<>'general' or p_manifest->'project'->>'ageRating' not in ('全年齢','12歳以上','15歳以上') then raise exception 'general_cloud_import_required'; end if;
insert into public.cloud_projects(id,owner_profile_id,source_surface,source_project_id,content_class,title,description,age_rating,reading_direction,width,height,dpi)
values(v_project_id,v_profile_id,'desktop',(p_manifest->'project'->>'sourceProjectId')::uuid,'general',p_manifest->'project'->>'title',coalesce(p_manifest->'project'->>'description',''),p_manifest->'project'->>'ageRating',p_manifest->'project'->>'readingDirection',(p_manifest->'project'->>'width')::integer,(p_manifest->'project'->>'height')::integer,(p_manifest->'project'->>'dpi')::integer);
for v_episode in select value from jsonb_array_elements(coalesce(p_manifest->'episodes','[]'::jsonb)) loop insert into public.cloud_episodes(id,project_id,title,order_index) values((v_episode->>'id')::uuid,v_project_id,v_episode->>'title',(v_episode->>'orderIndex')::integer); end loop;
for v_page in select value from jsonb_array_elements(coalesce(p_manifest->'pages','[]'::jsonb)) loop insert into public.cloud_pages(id,project_id,episode_id,page_number,order_index,width,height,background_color) values((v_page->>'id')::uuid,v_project_id,(v_page->>'episodeId')::uuid,(v_page->>'pageNumber')::integer,(v_page->>'orderIndex')::integer,(v_page->>'width')::integer,(v_page->>'height')::integer,v_page->>'backgroundColor'); end loop;
for v_snapshot in select value from jsonb_array_elements(coalesce(p_manifest->'snapshots','[]'::jsonb)) loop insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id) values(v_project_id,(v_snapshot->>'pageId')::uuid,0,v_snapshot->'canvas',v_profile_id); end loop;
insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_project_id,0,p_manifest,v_profile_id); return v_project_id; end $$;
revoke execute on function public.save_cloud_page_snapshot(uuid,bigint,jsonb) from public,anon;
revoke execute on function public.soft_delete_cloud_project(uuid) from public,anon;
revoke execute on function public.restore_cloud_project(uuid) from public,anon;
revoke execute on function public.import_cloud_project(jsonb) from public,anon;
grant execute on function public.save_cloud_page_snapshot(uuid,bigint,jsonb) to authenticated,service_role;
grant execute on function public.soft_delete_cloud_project(uuid) to authenticated,service_role;
grant execute on function public.restore_cloud_project(uuid) to authenticated,service_role;
grant execute on function public.import_cloud_project(jsonb) to authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cloud-assets','cloud-assets',false,20971520,array['image/png','image/jpeg','image/webp']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "cloud_assets_storage_read" on storage.objects; drop policy if exists "cloud_assets_storage_insert" on storage.objects;
drop policy if exists "cloud_assets_storage_update" on storage.objects; drop policy if exists "cloud_assets_storage_delete" on storage.objects;
create policy "cloud_assets_storage_read" on storage.objects for select using(bucket_id='cloud-assets' and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_read(((storage.foldername(name))[2])::uuid) else false end);
create policy "cloud_assets_storage_insert" on storage.objects for insert with check(bucket_id='cloud-assets' and auth.role()='authenticated' and (storage.foldername(name))[1]=public.current_profile_id()::text and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid) else false end);
create policy "cloud_assets_storage_update" on storage.objects for update using(bucket_id='cloud-assets' and (storage.foldername(name))[1]=public.current_profile_id()::text and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid) else false end)
with check(bucket_id='cloud-assets' and (storage.foldername(name))[1]=public.current_profile_id()::text and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid) else false end);
create policy "cloud_assets_storage_delete" on storage.objects for delete using(bucket_id='cloud-assets' and (storage.foldername(name))[1]=public.current_profile_id()::text and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid) else false end);

alter table public.cloud_projects add column if not exists cover_page_id uuid;
do $$ begin if not exists(select 1 from pg_constraint where conname='cloud_projects_cover_page_id_fkey' and conrelid='public.cloud_projects'::regclass) then alter table public.cloud_projects add constraint cloud_projects_cover_page_id_fkey foreign key(cover_page_id) references public.cloud_pages(id) on delete set null; end if; end $$;
create or replace function public.create_cloud_project_with_first_page(p_title text,p_description text default '',p_age_rating text default '全年齢',p_reading_direction text default 'rtl',p_width integer default 1600,p_height integer default 2400,p_dpi integer default 300)
returns table(project_id uuid,episode_id uuid,page_id uuid) language plpgsql security invoker set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id();
begin if v_profile_id is null then raise exception 'profile_required'; end if; project_id:=gen_random_uuid(); episode_id:=gen_random_uuid(); page_id:=gen_random_uuid();
insert into public.cloud_projects(id,owner_profile_id,source_surface,content_class,title,description,age_rating,reading_direction,width,height,dpi) values(project_id,v_profile_id,'cloud','general',trim(p_title),coalesce(p_description,''),p_age_rating,p_reading_direction,p_width,p_height,p_dpi);
insert into public.cloud_episodes(id,project_id,title,order_index) values(episode_id,project_id,'第1話',0);
insert into public.cloud_pages(id,project_id,episode_id,page_number,order_index,width,height) values(page_id,project_id,episode_id,1,0,p_width,p_height);
insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id) values(project_id,page_id,0,jsonb_build_object('schemaVersion',1,'pageId',page_id,'width',p_width,'height',p_height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile_id);
insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(project_id,0,jsonb_build_object('event','project_created','episodeId',episode_id,'pageId',page_id),v_profile_id); return next; end $$;
create or replace function public.add_cloud_episode(p_project_id uuid,p_title text) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id(); v_episode_id uuid:=gen_random_uuid(); v_order integer; v_revision bigint;
begin if not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if; perform 1 from public.cloud_projects where id=p_project_id for update; select coalesce(max(order_index),-1)+1 into v_order from public.cloud_episodes where project_id=p_project_id; insert into public.cloud_episodes(id,project_id,title,order_index) values(v_episode_id,p_project_id,trim(p_title),v_order); update public.cloud_projects set revision=revision+1,updated_at=now() where id=p_project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(p_project_id,v_revision,jsonb_build_object('event','episode_added','episodeId',v_episode_id),v_profile_id); return v_episode_id; end $$;
create or replace function public.add_cloud_page(p_episode_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id(); v_episode public.cloud_episodes%rowtype; v_project public.cloud_projects%rowtype; v_page_id uuid:=gen_random_uuid(); v_order integer; v_page_number integer; v_revision bigint;
begin select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if; select * into v_project from public.cloud_projects where id=v_episode.project_id for update; select coalesce(max(order_index),-1)+1 into v_order from public.cloud_pages where episode_id=p_episode_id; select coalesce(max(page_number),0)+1 into v_page_number from public.cloud_pages where project_id=v_episode.project_id; insert into public.cloud_pages(id,project_id,episode_id,page_number,order_index,width,height) values(v_page_id,v_episode.project_id,p_episode_id,v_page_number,v_order,v_project.width,v_project.height); insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id) values(v_episode.project_id,v_page_id,0,jsonb_build_object('schemaVersion',1,'pageId',v_page_id,'width',v_project.width,'height',v_project.height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile_id); update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','page_added','pageId',v_page_id,'episodeId',p_episode_id),v_profile_id); return v_page_id; end $$;
create or replace function public.rename_cloud_project(p_project_id uuid,p_title text,p_description text) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin if not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if; update public.cloud_projects set title=trim(p_title),description=coalesce(p_description,''),revision=revision+1,updated_at=now() where id=p_project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(p_project_id,v_revision,jsonb_build_object('event','project_metadata_updated'),v_profile_id); return p_project_id; end $$;
create or replace function public.rename_cloud_episode(p_episode_id uuid,p_title text) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_episode public.cloud_episodes%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if; update public.cloud_episodes set title=trim(p_title),revision=revision+1,updated_at=now() where id=p_episode_id; update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','episode_renamed','episodeId',p_episode_id),v_profile_id); return p_episode_id; end $$;
revoke execute on function public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer) from public,anon; revoke execute on function public.add_cloud_episode(uuid,text) from public,anon; revoke execute on function public.add_cloud_page(uuid) from public,anon; revoke execute on function public.rename_cloud_project(uuid,text,text) from public,anon; revoke execute on function public.rename_cloud_episode(uuid,text) from public,anon;
grant execute on function public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer) to authenticated,service_role; grant execute on function public.add_cloud_episode(uuid,text) to authenticated,service_role; grant execute on function public.add_cloud_page(uuid) to authenticated,service_role; grant execute on function public.rename_cloud_project(uuid,text,text) to authenticated,service_role; grant execute on function public.rename_cloud_episode(uuid,text) to authenticated,service_role;
create or replace function public.move_cloud_episode(p_episode_id uuid,p_direction integer) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_episode public.cloud_episodes%rowtype; v_other public.cloud_episodes%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin if p_direction not in (-1,1) then raise exception 'invalid_move_direction'; end if; select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if; perform 1 from public.cloud_projects where id=v_episode.project_id for update; if p_direction=-1 then select * into v_other from public.cloud_episodes where project_id=v_episode.project_id and deleted_at is null and order_index<v_episode.order_index order by order_index desc limit 1; else select * into v_other from public.cloud_episodes where project_id=v_episode.project_id and deleted_at is null and order_index>v_episode.order_index order by order_index limit 1; end if; if not found then return p_episode_id; end if; update public.cloud_episodes set order_index=2147483647 where id=v_episode.id; update public.cloud_episodes set order_index=v_episode.order_index where id=v_other.id; update public.cloud_episodes set order_index=v_other.order_index where id=v_episode.id; update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','episode_moved','episodeId',p_episode_id),v_profile_id); return p_episode_id; end $$;
create or replace function public.move_cloud_page(p_page_id uuid,p_direction integer) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_page public.cloud_pages%rowtype; v_other public.cloud_pages%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin if p_direction not in (-1,1) then raise exception 'invalid_move_direction'; end if; select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'cloud_page_not_editable'; end if; perform 1 from public.cloud_projects where id=v_page.project_id for update; if p_direction=-1 then select * into v_other from public.cloud_pages where episode_id=v_page.episode_id and deleted_at is null and order_index<v_page.order_index order by order_index desc limit 1; else select * into v_other from public.cloud_pages where episode_id=v_page.episode_id and deleted_at is null and order_index>v_page.order_index order by order_index limit 1; end if; if not found then return p_page_id; end if; update public.cloud_pages set order_index=2147483647 where id=v_page.id; update public.cloud_pages set order_index=v_page.order_index where id=v_other.id; update public.cloud_pages set order_index=v_other.order_index where id=v_page.id; update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_revision,jsonb_build_object('event','page_moved','pageId',p_page_id),v_profile_id); return p_page_id; end $$;
create or replace function public.soft_delete_cloud_episode(p_episode_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_episode public.cloud_episodes%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if; perform 1 from public.cloud_projects where id=v_episode.project_id for update; if (select count(*) from public.cloud_episodes where project_id=v_episode.project_id and deleted_at is null)<=1 then raise exception 'last_episode_cannot_be_deleted'; end if; update public.cloud_episodes set deleted_at=now(),updated_at=now() where id=p_episode_id; update public.cloud_pages set deleted_at=now(),updated_at=now() where episode_id=p_episode_id and deleted_at is null; update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','episode_deleted','episodeId',p_episode_id),v_profile_id); return p_episode_id; end $$;
create or replace function public.soft_delete_cloud_page(p_page_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_page public.cloud_pages%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'cloud_page_not_editable'; end if; perform 1 from public.cloud_projects where id=v_page.project_id for update; if (select count(*) from public.cloud_pages where project_id=v_page.project_id and deleted_at is null)<=1 then raise exception 'last_page_cannot_be_deleted'; end if; update public.cloud_pages set deleted_at=now(),updated_at=now() where id=p_page_id; update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_revision,jsonb_build_object('event','page_deleted','pageId',p_page_id),v_profile_id); return p_page_id; end $$;
revoke execute on function public.move_cloud_episode(uuid,integer) from public,anon; revoke execute on function public.move_cloud_page(uuid,integer) from public,anon; revoke execute on function public.soft_delete_cloud_episode(uuid) from public,anon; revoke execute on function public.soft_delete_cloud_page(uuid) from public,anon;
grant execute on function public.move_cloud_episode(uuid,integer) to authenticated,service_role; grant execute on function public.move_cloud_page(uuid,integer) to authenticated,service_role; grant execute on function public.soft_delete_cloud_episode(uuid) to authenticated,service_role; grant execute on function public.soft_delete_cloud_page(uuid) to authenticated,service_role;
create or replace function public.soft_delete_cloud_episode(p_episode_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_episode public.cloud_episodes%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if; perform 1 from public.cloud_projects where id=v_episode.project_id for update; if (select count(*) from public.cloud_episodes where project_id=v_episode.project_id and deleted_at is null)<=1 then raise exception 'last_episode_cannot_be_deleted'; end if; update public.cloud_episodes set deleted_at=now(),updated_at=now() where id=p_episode_id; update public.cloud_pages set deleted_at=now(),updated_at=now() where episode_id=p_episode_id and deleted_at is null; update public.cloud_projects set cover_page_id=case when exists(select 1 from public.cloud_pages where id=cloud_projects.cover_page_id and episode_id=p_episode_id) then null else cover_page_id end,revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','episode_deleted','episodeId',p_episode_id),v_profile_id); return p_episode_id; end $$;
create or replace function public.soft_delete_cloud_page(p_page_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_page public.cloud_pages%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null; if not found or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'cloud_page_not_editable'; end if; perform 1 from public.cloud_projects where id=v_page.project_id for update; if (select count(*) from public.cloud_pages where project_id=v_page.project_id and deleted_at is null)<=1 then raise exception 'last_page_cannot_be_deleted'; end if; update public.cloud_pages set deleted_at=now(),updated_at=now() where id=p_page_id; update public.cloud_projects set cover_page_id=case when cover_page_id=p_page_id then null else cover_page_id end,revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_revision,jsonb_build_object('event','page_deleted','pageId',p_page_id),v_profile_id); return p_page_id; end $$;
create or replace function public.set_cloud_project_cover(p_project_id uuid,p_page_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$ declare v_profile_id uuid:=public.current_profile_id(); v_revision bigint; begin if not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if; if not exists(select 1 from public.cloud_pages where id=p_page_id and project_id=p_project_id and deleted_at is null) then raise exception 'cover_page_not_found'; end if; update public.cloud_projects set cover_page_id=p_page_id,revision=revision+1,updated_at=now() where id=p_project_id returning revision into v_revision; insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(p_project_id,v_revision,jsonb_build_object('event','cover_page_changed','pageId',p_page_id),v_profile_id); return p_page_id; end $$;
revoke execute on function public.set_cloud_project_cover(uuid,uuid) from public,anon; grant execute on function public.set_cloud_project_cover(uuid,uuid) to authenticated,service_role;

create table if not exists public.cloud_generation_jobs(
id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,page_id uuid,created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
kind text not null check(kind in('image','text')),job_type text not null check(job_type in('background','prop','effect','character_base','story','storyboard','speech_bubble')),
provider_id text not null check(char_length(provider_id) between 1 and 100),model_id text not null check(char_length(model_id) between 1 and 200),idempotency_key text not null check(char_length(idempotency_key) between 1 and 200),prompt_sha256 text not null check(prompt_sha256 ~ '^[0-9a-f]{64}$'),
input jsonb not null check(jsonb_typeof(input)='object' and pg_column_size(input)<=65536),moderation jsonb not null check(jsonb_typeof(moderation)='object' and moderation->>'decision'='allow' and moderation->>'policyVersion'='1'),
status text not null default 'queued' check(status in('queued','running','completed','failed','canceled')),progress integer not null default 0 check(progress between 0 and 100),attempt_count integer not null default 0 check(attempt_count between 0 and 3),max_attempts integer not null default 2 check(max_attempts between 1 and 3),
estimated_cost_micros bigint check(estimated_cost_micros is null or estimated_cost_micros>=0),actual_cost_micros bigint check(actual_cost_micros is null or actual_cost_micros>=0),provider_job_id text check(provider_job_id is null or char_length(provider_job_id)<=300),output jsonb check(output is null or(jsonb_typeof(output)='object' and pg_column_size(output)<=65536)),output_asset_id uuid references public.cloud_assets(id) on delete set null,
error_code text check(error_code is null or char_length(error_code)<=100),error_message text check(error_message is null or char_length(error_message)<=500),lease_token uuid,lease_expires_at timestamptz,retry_at timestamptz,started_at timestamptz,finished_at timestamptz,canceled_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
unique(created_by_profile_id,idempotency_key),foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade);
create index if not exists cloud_generation_jobs_queue_idx on public.cloud_generation_jobs(status,retry_at,created_at) where status='queued';
create index if not exists cloud_generation_jobs_project_idx on public.cloud_generation_jobs(project_id,created_at desc);
alter table public.cloud_generation_jobs enable row level security;
grant select on public.cloud_generation_jobs to authenticated; grant select,insert,update on public.cloud_generation_jobs to service_role;
drop policy if exists "cloud_generation_jobs_read" on public.cloud_generation_jobs;
create policy "cloud_generation_jobs_read" on public.cloud_generation_jobs for select using(public.cloud_project_can_edit(project_id));

create or replace function public.enqueue_cloud_generation_job(p_project_id uuid,p_page_id uuid,p_kind text,p_job_type text,p_provider_id text,p_model_id text,p_idempotency_key text,p_prompt_sha256 text,p_input jsonb,p_moderation jsonb,p_estimated_cost_micros bigint default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id(); v_job_id uuid;
begin if v_profile_id is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if;
if not exists(select 1 from public.cloud_projects where id=p_project_id and content_class='general' and deleted_at is null) then raise exception 'general_cloud_project_required'; end if;
if p_page_id is not null and not exists(select 1 from public.cloud_pages where id=p_page_id and project_id=p_project_id and deleted_at is null) then raise exception 'cloud_page_not_found'; end if;
if p_kind not in('image','text') or p_job_type not in('background','prop','effect','character_base','story','storyboard','speech_bubble') or(p_kind='image' and p_job_type not in('background','prop','effect','character_base')) or(p_kind='text' and p_job_type not in('story','storyboard','speech_bubble')) or p_input->>'kind' is distinct from p_kind or p_input->>'jobType' is distinct from p_job_type or nullif(trim(p_input->>'prompt'),'') is null or p_moderation->>'decision' is distinct from 'allow' or p_moderation->>'policyVersion' is distinct from '1' then raise exception 'cloud_generation_input_rejected'; end if;
insert into public.cloud_generation_jobs(project_id,page_id,created_by_profile_id,kind,job_type,provider_id,model_id,idempotency_key,prompt_sha256,input,moderation,estimated_cost_micros) values(p_project_id,p_page_id,v_profile_id,p_kind,p_job_type,trim(p_provider_id),trim(p_model_id),trim(p_idempotency_key),p_prompt_sha256,p_input,p_moderation,p_estimated_cost_micros) on conflict(created_by_profile_id,idempotency_key) do update set updated_at=public.cloud_generation_jobs.updated_at returning id into v_job_id; return v_job_id; end $$;
create or replace function public.cancel_cloud_generation_job(p_job_id uuid) returns uuid language plpgsql security definer set search_path=public as $$ begin update public.cloud_generation_jobs set status='canceled',canceled_at=now(),finished_at=now(),lease_token=null,lease_expires_at=null,updated_at=now() where id=p_job_id and status in('queued','running') and public.cloud_project_can_edit(project_id); if not found then raise exception 'cloud_generation_job_not_cancelable'; end if; return p_job_id; end $$;
create or replace function public.claim_cloud_generation_job(p_worker_id text,p_lease_seconds integer default 120) returns setof public.cloud_generation_jobs language plpgsql security definer set search_path=public as $$ declare v_job_id uuid; v_token uuid:=gen_random_uuid(); begin if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 30 and 900 then raise exception 'cloud_worker_not_authorized'; end if; select id into v_job_id from public.cloud_generation_jobs where(status='queued' and(retry_at is null or retry_at<=now())) or(status='running' and lease_expires_at<=now()) order by created_at for update skip locked limit 1; if v_job_id is null then return; end if; return query update public.cloud_generation_jobs set status='running',progress=1,attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),started_at=coalesce(started_at,now()),updated_at=now() where id=v_job_id returning *; end $$;
create or replace function public.extend_cloud_generation_job_lease(p_job_id uuid,p_lease_token uuid,p_lease_seconds integer default 300) returns timestamptz language plpgsql security definer set search_path=public as $$ declare v_expires_at timestamptz; begin if auth.role()<>'service_role' or p_lease_seconds not between 150 and 900 then raise exception 'cloud_worker_not_authorized'; end if; update public.cloud_generation_jobs set lease_expires_at=now()+make_interval(secs=>p_lease_seconds),updated_at=now() where id=p_job_id and status='running' and lease_token=p_lease_token and lease_expires_at>now() returning lease_expires_at into v_expires_at; if v_expires_at is null then raise exception 'cloud_generation_lease_invalid'; end if; return v_expires_at; end $$;
create or replace function public.finish_cloud_generation_job(p_job_id uuid,p_lease_token uuid,p_succeeded boolean,p_output jsonb default null,p_output_asset_id uuid default null,p_provider_job_id text default null,p_actual_cost_micros bigint default null,p_error_code text default null,p_error_message text default null,p_retryable boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_generation_jobs%rowtype; begin if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if; select * into v_job from public.cloud_generation_jobs where id=p_job_id and status='running' and lease_token=p_lease_token for update; if not found then raise exception 'cloud_generation_lease_invalid'; end if; if p_output_asset_id is not null and not exists(select 1 from public.cloud_assets where id=p_output_asset_id and project_id=v_job.project_id) then raise exception 'cloud_generation_output_asset_invalid'; end if;
if p_succeeded then update public.cloud_generation_jobs set status='completed',progress=100,output=coalesce(p_output,'{}'::jsonb),output_asset_id=p_output_asset_id,provider_job_id=p_provider_job_id,actual_cost_micros=p_actual_cost_micros,error_code=null,error_message=null,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=p_job_id;
elsif p_retryable and v_job.attempt_count<v_job.max_attempts then update public.cloud_generation_jobs set status='queued',progress=0,provider_job_id=p_provider_job_id,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,retry_at=now()+make_interval(secs=>5*power(2,v_job.attempt_count-1)::integer),updated_at=now() where id=p_job_id;
else update public.cloud_generation_jobs set status='failed',provider_job_id=p_provider_job_id,actual_cost_micros=p_actual_cost_micros,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=p_job_id; end if; return p_job_id; end $$;
revoke execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) from public,anon; revoke execute on function public.cancel_cloud_generation_job(uuid) from public,anon; revoke execute on function public.claim_cloud_generation_job(text,integer) from public,anon,authenticated; revoke execute on function public.extend_cloud_generation_job_lease(uuid,uuid,integer) from public,anon,authenticated; revoke execute on function public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) to authenticated,service_role; grant execute on function public.cancel_cloud_generation_job(uuid) to authenticated,service_role; grant execute on function public.claim_cloud_generation_job(text,integer) to service_role; grant execute on function public.extend_cloud_generation_job_lease(uuid,uuid,integer) to service_role; grant execute on function public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean) to service_role;

create table if not exists public.cloud_ai_plans(plan_key text primary key check(plan_key in('free','trial','creator')),display_name text not null,monthly_credits integer not null check(monthly_credits>=0),monthly_cost_limit_micros bigint not null check(monthly_cost_limit_micros>=0),currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),user_requests_per_minute integer not null check(user_requests_per_minute between 1 and 1000),project_requests_per_minute integer not null check(project_requests_per_minute between 1 and 1000),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
insert into public.cloud_ai_plans(plan_key,display_name,monthly_credits,monthly_cost_limit_micros,user_requests_per_minute,project_requests_per_minute) values('free','Free',20,2000000,5,3),('trial','Trial',100,10000000,10,6),('creator','Creator',1000,100000000,30,20) on conflict(plan_key) do nothing;
create table if not exists public.cloud_ai_entitlements(profile_id uuid primary key references public.profiles(id) on delete cascade,plan_key text not null references public.cloud_ai_plans(plan_key),status text not null default 'active' check(status in('active','trialing','past_due','canceled','expired')),source text not null default 'default' check(source in('default','admin','stripe')),period_starts_at timestamptz not null,period_ends_at timestamptz not null,stripe_customer_id text unique,stripe_subscription_id text unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(period_ends_at>period_starts_at));
create table if not exists public.cloud_ai_provider_prices(id uuid primary key default gen_random_uuid(),provider_id text not null,model_id text not null,kind text not null check(kind in('image','text')),job_type text not null check(job_type in('background','prop','effect','character_base','story','storyboard','speech_bubble')),pricing_version text not null,credits integer not null check(credits between 1 and 1000),max_cost_micros bigint not null check(max_cost_micros>=0),currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),active boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(provider_id,model_id,job_type,pricing_version));
create unique index if not exists cloud_ai_provider_prices_active_idx on public.cloud_ai_provider_prices(provider_id,model_id,job_type) where active;
create table if not exists public.cloud_ai_usage_periods(profile_id uuid not null references public.profiles(id) on delete cascade,period_starts_at timestamptz not null,period_ends_at timestamptz not null,plan_key text not null references public.cloud_ai_plans(plan_key),credits_reserved integer not null default 0 check(credits_reserved>=0),credits_used integer not null default 0 check(credits_used>=0),cost_reserved_micros bigint not null default 0 check(cost_reserved_micros>=0),cost_actual_micros bigint not null default 0 check(cost_actual_micros>=0),updated_at timestamptz not null default now(),primary key(profile_id,period_starts_at),check(period_ends_at>period_starts_at));
create table if not exists public.cloud_ai_daily_costs(usage_date date primary key,cost_reserved_micros bigint not null default 0 check(cost_reserved_micros>=0),cost_actual_micros bigint not null default 0 check(cost_actual_micros>=0),updated_at timestamptz not null default now());
create table if not exists public.cloud_ai_settings(singleton boolean primary key default true check(singleton),generation_enabled boolean not null default false,daily_cost_limit_micros bigint not null default 100000000 check(daily_cost_limit_micros>=0),warning_percent integer not null default 80 check(warning_percent between 1 and 100),updated_at timestamptz not null default now());
insert into public.cloud_ai_settings(singleton) values(true) on conflict(singleton) do nothing;
create table if not exists public.cloud_ai_rate_limits(scope text not null check(scope in('user','project','ip','global')),subject_key text not null check(char_length(subject_key) between 16 and 128),request_count integer not null default 0 check(request_count>=0),window_started_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(scope,subject_key));
create table if not exists public.cloud_ai_cost_ledger(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(id) on delete restrict,project_id uuid not null references public.cloud_projects(id) on delete restrict,job_id uuid not null references public.cloud_generation_jobs(id) on delete restrict,event_type text not null check(event_type in('reserve','settle','release')),credits_reserved_delta integer not null default 0,credits_used_delta integer not null default 0,cost_reserved_delta_micros bigint not null default 0,cost_actual_delta_micros bigint not null default 0,currency text not null check(currency ~ '^[A-Z]{3}$'),pricing_version text not null,created_at timestamptz not null default now(),unique(job_id,event_type),check(credits_reserved_delta<>0 or credits_used_delta<>0 or cost_reserved_delta_micros<>0 or cost_actual_delta_micros<>0));
alter table public.cloud_generation_jobs add column if not exists reserved_credits integer check(reserved_credits is null or reserved_credits>0),add column if not exists reserved_cost_micros bigint check(reserved_cost_micros is null or reserved_cost_micros>=0),add column if not exists billing_period_starts_at timestamptz,add column if not exists reservation_date date,add column if not exists pricing_version text,add column if not exists billing_settled_at timestamptz;
alter table public.cloud_ai_plans enable row level security; alter table public.cloud_ai_entitlements enable row level security; alter table public.cloud_ai_provider_prices enable row level security; alter table public.cloud_ai_usage_periods enable row level security; alter table public.cloud_ai_daily_costs enable row level security; alter table public.cloud_ai_settings enable row level security; alter table public.cloud_ai_rate_limits enable row level security; alter table public.cloud_ai_cost_ledger enable row level security;
grant select on public.cloud_ai_plans,public.cloud_ai_provider_prices to authenticated; grant select on public.cloud_ai_entitlements,public.cloud_ai_usage_periods,public.cloud_ai_cost_ledger to authenticated; grant select,insert,update on public.cloud_ai_plans,public.cloud_ai_entitlements,public.cloud_ai_provider_prices,public.cloud_ai_usage_periods,public.cloud_ai_daily_costs,public.cloud_ai_settings,public.cloud_ai_rate_limits,public.cloud_ai_cost_ledger to service_role;
drop policy if exists "cloud_ai_plans_read" on public.cloud_ai_plans; create policy "cloud_ai_plans_read" on public.cloud_ai_plans for select using(active);
drop policy if exists "cloud_ai_prices_read" on public.cloud_ai_provider_prices; create policy "cloud_ai_prices_read" on public.cloud_ai_provider_prices for select using(active);
drop policy if exists "cloud_ai_entitlements_read" on public.cloud_ai_entitlements; create policy "cloud_ai_entitlements_read" on public.cloud_ai_entitlements for select using(profile_id=public.current_profile_id());
drop policy if exists "cloud_ai_usage_read" on public.cloud_ai_usage_periods; create policy "cloud_ai_usage_read" on public.cloud_ai_usage_periods for select using(profile_id=public.current_profile_id());
drop policy if exists "cloud_ai_ledger_read" on public.cloud_ai_cost_ledger; create policy "cloud_ai_ledger_read" on public.cloud_ai_cost_ledger for select using(profile_id=public.current_profile_id());
create or replace function public.provision_cloud_ai_entitlement() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.cloud_ai_entitlements(profile_id,plan_key,status,source,period_starts_at,period_ends_at) values(new.id,'free','active','default',date_trunc('month',now()),date_trunc('month',now())+interval '1 month') on conflict(profile_id) do nothing; return new; end $$;
drop trigger if exists profiles_provision_cloud_ai_entitlement on public.profiles; create trigger profiles_provision_cloud_ai_entitlement after insert on public.profiles for each row execute function public.provision_cloud_ai_entitlement();
insert into public.cloud_ai_entitlements(profile_id,plan_key,status,source,period_starts_at,period_ends_at) select id,'free','active','default',date_trunc('month',now()),date_trunc('month',now())+interval '1 month' from public.profiles on conflict(profile_id) do nothing;
create or replace function public.consume_cloud_ai_rate_limit(p_scope text,p_subject_key text,p_request_limit integer,p_window_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$ declare v_row public.cloud_ai_rate_limits%rowtype; begin if p_scope not in('user','project','ip','global') or char_length(p_subject_key) not between 16 and 128 or p_request_limit not between 1 and 1000 or p_window_seconds not between 1 and 86400 then raise exception 'cloud_ai_rate_limit_input_invalid'; end if; insert into public.cloud_ai_rate_limits(scope,subject_key) values(p_scope,p_subject_key) on conflict(scope,subject_key) do nothing; select * into v_row from public.cloud_ai_rate_limits where scope=p_scope and subject_key=p_subject_key for update; if v_row.window_started_at<=now()-make_interval(secs=>p_window_seconds) then update public.cloud_ai_rate_limits set request_count=1,window_started_at=now(),updated_at=now() where scope=p_scope and subject_key=p_subject_key; return true; end if; if v_row.request_count>=p_request_limit then return false; end if; update public.cloud_ai_rate_limits set request_count=request_count+1,updated_at=now() where scope=p_scope and subject_key=p_subject_key; return true; end $$;
create or replace function public.enqueue_cloud_generation_job_with_quota(p_project_id uuid,p_page_id uuid,p_kind text,p_job_type text,p_provider_id text,p_model_id text,p_idempotency_key text,p_prompt_sha256 text,p_input jsonb,p_moderation jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id(); v_job_id uuid; v_ent public.cloud_ai_entitlements%rowtype; v_plan public.cloud_ai_plans%rowtype; v_price public.cloud_ai_provider_prices%rowtype; v_usage public.cloud_ai_usage_periods%rowtype; v_daily public.cloud_ai_daily_costs%rowtype; v_settings public.cloud_ai_settings%rowtype; v_today date:=current_date;
begin if v_profile_id is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if; select id into v_job_id from public.cloud_generation_jobs where created_by_profile_id=v_profile_id and idempotency_key=p_idempotency_key; if v_job_id is not null then return v_job_id; end if;
if not exists(select 1 from public.cloud_projects where id=p_project_id and content_class='general' and deleted_at is null) then raise exception 'general_cloud_project_required'; end if; if p_page_id is not null and not exists(select 1 from public.cloud_pages where id=p_page_id and project_id=p_project_id and deleted_at is null) then raise exception 'cloud_page_not_found'; end if;
if p_kind not in('image','text') or p_job_type not in('background','prop','effect','character_base','story','storyboard','speech_bubble') or(p_kind='image' and p_job_type not in('background','prop','effect','character_base')) or(p_kind='text' and p_job_type not in('story','storyboard','speech_bubble')) or p_input->>'kind' is distinct from p_kind or p_input->>'jobType' is distinct from p_job_type or nullif(trim(p_input->>'prompt'),'') is null or p_moderation->>'decision' is distinct from 'allow' or p_moderation->>'policyVersion' is distinct from '1' then raise exception 'cloud_generation_input_rejected'; end if;
select * into v_settings from public.cloud_ai_settings where singleton for update; if not v_settings.generation_enabled then raise exception 'cloud_generation_disabled'; end if; select * into v_price from public.cloud_ai_provider_prices where provider_id=trim(p_provider_id) and model_id=trim(p_model_id) and job_type=p_job_type and kind=p_kind and active; if not found then raise exception 'cloud_generation_price_unavailable'; end if;
select * into v_ent from public.cloud_ai_entitlements where profile_id=v_profile_id for update; if v_ent.source='default' and v_ent.period_ends_at<=now() then update public.cloud_ai_entitlements set period_starts_at=date_trunc('month',now()),period_ends_at=date_trunc('month',now())+interval '1 month',status='active',updated_at=now() where profile_id=v_profile_id returning * into v_ent; end if; if v_ent.status not in('active','trialing') or now()<v_ent.period_starts_at or now()>=v_ent.period_ends_at then raise exception 'cloud_entitlement_inactive'; end if;
select * into v_plan from public.cloud_ai_plans where plan_key=v_ent.plan_key and active; if not found or v_plan.currency<>v_price.currency then raise exception 'cloud_plan_unavailable'; end if; if not public.consume_cloud_ai_rate_limit('user',v_profile_id::text,v_plan.user_requests_per_minute,60) or not public.consume_cloud_ai_rate_limit('project',p_project_id::text,v_plan.project_requests_per_minute,60) then raise exception 'cloud_generation_rate_limited'; end if;
insert into public.cloud_ai_usage_periods(profile_id,period_starts_at,period_ends_at,plan_key) values(v_profile_id,v_ent.period_starts_at,v_ent.period_ends_at,v_ent.plan_key) on conflict(profile_id,period_starts_at) do nothing; select * into v_usage from public.cloud_ai_usage_periods where profile_id=v_profile_id and period_starts_at=v_ent.period_starts_at for update; if v_usage.credits_reserved+v_usage.credits_used+v_price.credits>v_plan.monthly_credits then raise exception 'cloud_credit_quota_exceeded'; end if; if v_usage.cost_reserved_micros+v_usage.cost_actual_micros+v_price.max_cost_micros>v_plan.monthly_cost_limit_micros then raise exception 'cloud_cost_quota_exceeded'; end if;
insert into public.cloud_ai_daily_costs(usage_date) values(v_today) on conflict(usage_date) do nothing; select * into v_daily from public.cloud_ai_daily_costs where usage_date=v_today for update; if v_daily.cost_reserved_micros+v_daily.cost_actual_micros+v_price.max_cost_micros>v_settings.daily_cost_limit_micros then raise exception 'cloud_daily_budget_exceeded'; end if;
insert into public.cloud_generation_jobs(project_id,page_id,created_by_profile_id,kind,job_type,provider_id,model_id,idempotency_key,prompt_sha256,input,moderation,estimated_cost_micros,reserved_credits,reserved_cost_micros,billing_period_starts_at,reservation_date,pricing_version) values(p_project_id,p_page_id,v_profile_id,p_kind,p_job_type,trim(p_provider_id),trim(p_model_id),trim(p_idempotency_key),p_prompt_sha256,p_input,p_moderation,v_price.max_cost_micros,v_price.credits,v_price.max_cost_micros,v_ent.period_starts_at,v_today,v_price.pricing_version) returning id into v_job_id;
update public.cloud_ai_usage_periods set credits_reserved=credits_reserved+v_price.credits,cost_reserved_micros=cost_reserved_micros+v_price.max_cost_micros,updated_at=now() where profile_id=v_profile_id and period_starts_at=v_ent.period_starts_at; update public.cloud_ai_daily_costs set cost_reserved_micros=cost_reserved_micros+v_price.max_cost_micros,updated_at=now() where usage_date=v_today; insert into public.cloud_ai_cost_ledger(profile_id,project_id,job_id,event_type,credits_reserved_delta,cost_reserved_delta_micros,currency,pricing_version) values(v_profile_id,p_project_id,v_job_id,'reserve',v_price.credits,v_price.max_cost_micros,v_price.currency,v_price.pricing_version); return v_job_id; end $$;
create or replace function public.cancel_cloud_generation_job(p_job_id uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare v_job public.cloud_generation_jobs%rowtype; v_currency text; begin select * into v_job from public.cloud_generation_jobs where id=p_job_id and status in('queued','running') and public.cloud_project_can_edit(project_id) for update; if not found then raise exception 'cloud_generation_job_not_cancelable'; end if; if v_job.reserved_credits is not null and v_job.billing_settled_at is null then select currency into v_currency from public.cloud_ai_plans p join public.cloud_ai_usage_periods u on u.plan_key=p.plan_key where u.profile_id=v_job.created_by_profile_id and u.period_starts_at=v_job.billing_period_starts_at; update public.cloud_ai_usage_periods set credits_reserved=greatest(0,credits_reserved-v_job.reserved_credits),cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),updated_at=now() where profile_id=v_job.created_by_profile_id and period_starts_at=v_job.billing_period_starts_at; update public.cloud_ai_daily_costs set cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),updated_at=now() where usage_date=v_job.reservation_date; insert into public.cloud_ai_cost_ledger(profile_id,project_id,job_id,event_type,credits_reserved_delta,cost_reserved_delta_micros,currency,pricing_version) values(v_job.created_by_profile_id,v_job.project_id,v_job.id,'release',-v_job.reserved_credits,-v_job.reserved_cost_micros,v_currency,v_job.pricing_version); end if; update public.cloud_generation_jobs set status='canceled',canceled_at=now(),finished_at=now(),billing_settled_at=case when reserved_credits is null then billing_settled_at else now() end,lease_token=null,lease_expires_at=null,updated_at=now() where id=p_job_id; return p_job_id; end $$;
create or replace function public.finish_cloud_generation_job(p_job_id uuid,p_lease_token uuid,p_succeeded boolean,p_output jsonb default null,p_output_asset_id uuid default null,p_provider_job_id text default null,p_actual_cost_micros bigint default null,p_error_code text default null,p_error_message text default null,p_retryable boolean default false) returns uuid language plpgsql security definer set search_path=public as $$ declare v_job public.cloud_generation_jobs%rowtype; v_currency text; v_actual bigint:=coalesce(p_actual_cost_micros,0); v_final boolean; begin if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if; if v_actual<0 then raise exception 'cloud_generation_cost_invalid'; end if; select * into v_job from public.cloud_generation_jobs where id=p_job_id and status='running' and lease_token=p_lease_token for update; if not found then raise exception 'cloud_generation_lease_invalid'; end if; if p_output_asset_id is not null and not exists(select 1 from public.cloud_assets where id=p_output_asset_id and project_id=v_job.project_id) then raise exception 'cloud_generation_output_asset_invalid'; end if; v_final:=p_succeeded or not(p_retryable and v_job.attempt_count<v_job.max_attempts); if v_final and v_job.reserved_credits is not null and v_job.billing_settled_at is null then select currency into v_currency from public.cloud_ai_plans p join public.cloud_ai_usage_periods u on u.plan_key=p.plan_key where u.profile_id=v_job.created_by_profile_id and u.period_starts_at=v_job.billing_period_starts_at; update public.cloud_ai_usage_periods set credits_reserved=greatest(0,credits_reserved-v_job.reserved_credits),credits_used=credits_used+case when p_succeeded then v_job.reserved_credits else 0 end,cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),cost_actual_micros=cost_actual_micros+v_actual,updated_at=now() where profile_id=v_job.created_by_profile_id and period_starts_at=v_job.billing_period_starts_at; update public.cloud_ai_daily_costs set cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),cost_actual_micros=cost_actual_micros+v_actual,updated_at=now() where usage_date=v_job.reservation_date; insert into public.cloud_ai_cost_ledger(profile_id,project_id,job_id,event_type,credits_reserved_delta,credits_used_delta,cost_reserved_delta_micros,cost_actual_delta_micros,currency,pricing_version) values(v_job.created_by_profile_id,v_job.project_id,v_job.id,case when p_succeeded then 'settle' else 'release' end,-v_job.reserved_credits,case when p_succeeded then v_job.reserved_credits else 0 end,-v_job.reserved_cost_micros,v_actual,v_currency,v_job.pricing_version); update public.cloud_ai_settings set generation_enabled=false,updated_at=now() where singleton and exists(select 1 from public.cloud_ai_daily_costs where usage_date=v_job.reservation_date and cost_actual_micros>=daily_cost_limit_micros); end if;
if p_succeeded then update public.cloud_generation_jobs set status='completed',progress=100,output=coalesce(p_output,'{}'::jsonb),output_asset_id=p_output_asset_id,provider_job_id=p_provider_job_id,actual_cost_micros=v_actual,error_code=null,error_message=null,lease_token=null,lease_expires_at=null,finished_at=now(),billing_settled_at=case when reserved_credits is null then billing_settled_at else now() end,updated_at=now() where id=p_job_id; elsif p_retryable and v_job.attempt_count<v_job.max_attempts then update public.cloud_generation_jobs set status='queued',progress=0,provider_job_id=p_provider_job_id,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,retry_at=now()+make_interval(secs=>5*power(2,v_job.attempt_count-1)::integer),updated_at=now() where id=p_job_id; else update public.cloud_generation_jobs set status='failed',provider_job_id=p_provider_job_id,actual_cost_micros=v_actual,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,finished_at=now(),billing_settled_at=case when reserved_credits is null then billing_settled_at else now() end,updated_at=now() where id=p_job_id; end if; return p_job_id; end $$;
alter table public.cloud_assets add column if not exists source_generation_job_id uuid references public.cloud_generation_jobs(id) on delete set null;
create unique index if not exists cloud_assets_source_generation_job_idx on public.cloud_assets(source_generation_job_id) where source_generation_job_id is not null;
create table if not exists public.cloud_generation_storage_cleanup(id uuid primary key default gen_random_uuid(),job_id uuid references public.cloud_generation_jobs(id) on delete set null,bucket_id text not null check(bucket_id='cloud-assets'),storage_path text not null check(char_length(storage_path) between 1 and 700),reason text not null check(char_length(reason) between 1 and 200),status text not null default 'pending' check(status in('pending','resolved')),attempt_count integer not null default 0 check(attempt_count>=0),last_error text check(last_error is null or char_length(last_error)<=500),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz,unique(bucket_id,storage_path));
alter table public.cloud_generation_storage_cleanup enable row level security;
revoke all on public.cloud_generation_storage_cleanup from public,anon,authenticated;
grant select,insert,update,delete on public.cloud_generation_storage_cleanup to service_role;
create or replace function public.complete_cloud_generation_image_job(p_job_id uuid,p_lease_token uuid,p_asset_id uuid,p_storage_path text,p_file_name text,p_byte_size bigint,p_width integer,p_height integer,p_sha256 text,p_output jsonb,p_provider_job_id text,p_actual_cost_micros bigint) returns uuid language plpgsql security definer set search_path=public as $$ declare v_job public.cloud_generation_jobs%rowtype; v_existing_asset_id uuid; begin if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if; select * into v_job from public.cloud_generation_jobs where id=p_job_id for update; if not found then raise exception 'cloud_generation_job_not_found'; end if; select id into v_existing_asset_id from public.cloud_assets where source_generation_job_id=p_job_id; if v_job.status='completed' and v_existing_asset_id is not null and v_job.output_asset_id=v_existing_asset_id then return v_existing_asset_id; end if; if v_job.status<>'running' or v_job.lease_token<>p_lease_token then raise exception 'cloud_generation_lease_invalid'; end if; if v_job.kind<>'image' or p_output->>'kind'<>'image' or p_output->>'assetId'<>p_asset_id::text then raise exception 'cloud_generation_output_asset_invalid'; end if; insert into public.cloud_assets(id,project_id,owner_profile_id,storage_path,file_name,mime_type,byte_size,width,height,sha256,source_generation_job_id) values(p_asset_id,v_job.project_id,v_job.created_by_profile_id,p_storage_path,left(p_file_name,255),'image/png',p_byte_size,p_width,p_height,p_sha256,p_job_id); perform public.finish_cloud_generation_job(p_job_id,p_lease_token,true,p_output,p_asset_id,p_provider_job_id,p_actual_cost_micros,null,null,false); return p_asset_id; end $$;
create or replace function public.record_cloud_generation_storage_cleanup(p_job_id uuid,p_bucket_id text,p_storage_path text,p_reason text,p_last_error text) returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if; insert into public.cloud_generation_storage_cleanup(job_id,bucket_id,storage_path,reason,attempt_count,last_error) values(p_job_id,p_bucket_id,p_storage_path,left(p_reason,200),1,left(p_last_error,500)) on conflict(bucket_id,storage_path) do update set job_id=excluded.job_id,reason=excluded.reason,status='pending',attempt_count=public.cloud_generation_storage_cleanup.attempt_count+1,last_error=excluded.last_error,updated_at=now(),resolved_at=null returning id into v_id; return v_id; end $$;
create or replace function public.queue_orphan_cloud_generation_assets() returns integer language plpgsql security definer set search_path=public as $$ declare v_asset public.cloud_assets%rowtype; v_count integer:=0; begin if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if; for v_asset in select asset.* from public.cloud_assets asset join public.cloud_generation_jobs job on job.id=asset.source_generation_job_id where asset.deleted_at is null and(job.status<>'completed' or job.output_asset_id is distinct from asset.id) limit 100 for update of asset skip locked loop insert into public.cloud_generation_storage_cleanup(job_id,bucket_id,storage_path,reason) values(v_asset.source_generation_job_id,'cloud-assets',v_asset.storage_path,'orphan_cloud_generation_asset') on conflict(bucket_id,storage_path) do update set job_id=excluded.job_id,reason=excluded.reason,status='pending',updated_at=now(),resolved_at=null; update public.cloud_assets set deleted_at=now(),updated_at=now() where id=v_asset.id; v_count:=v_count+1; end loop; return v_count; end $$;
revoke execute on function public.complete_cloud_generation_image_job(uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint) from public,anon,authenticated; revoke execute on function public.record_cloud_generation_storage_cleanup(uuid,text,text,text,text) from public,anon,authenticated; revoke execute on function public.queue_orphan_cloud_generation_assets() from public,anon,authenticated;
grant execute on function public.complete_cloud_generation_image_job(uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint) to service_role; grant execute on function public.record_cloud_generation_storage_cleanup(uuid,text,text,text,text) to service_role; grant execute on function public.queue_orphan_cloud_generation_assets() to service_role;
create or replace function public.get_my_cloud_ai_quota() returns table(plan_key text,entitlement_status text,period_starts_at timestamptz,period_ends_at timestamptz,credits_limit integer,credits_reserved integer,credits_used integer,cost_limit_micros bigint,cost_reserved_micros bigint,cost_actual_micros bigint,currency text,generation_enabled boolean) language sql security definer set search_path=public as $$ select e.plan_key,e.status,e.period_starts_at,e.period_ends_at,p.monthly_credits,coalesce(u.credits_reserved,0),coalesce(u.credits_used,0),p.monthly_cost_limit_micros,coalesce(u.cost_reserved_micros,0),coalesce(u.cost_actual_micros,0),p.currency,s.generation_enabled from public.cloud_ai_entitlements e join public.cloud_ai_plans p on p.plan_key=e.plan_key cross join public.cloud_ai_settings s left join public.cloud_ai_usage_periods u on u.profile_id=e.profile_id and u.period_starts_at=e.period_starts_at where e.profile_id=public.current_profile_id() and s.singleton $$;
revoke execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) from authenticated; revoke execute on function public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb) from public,anon; revoke execute on function public.consume_cloud_ai_rate_limit(text,text,integer,integer) from public,anon,authenticated; revoke execute on function public.get_my_cloud_ai_quota() from public,anon; grant execute on function public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb) to authenticated,service_role; grant execute on function public.consume_cloud_ai_rate_limit(text,text,integer,integer) to service_role; grant execute on function public.get_my_cloud_ai_quota() to authenticated,service_role;
alter table public.cloud_ai_entitlements add column if not exists stripe_event_created_at timestamptz;
create table if not exists public.stripe_webhook_events(event_id text primary key check(char_length(event_id) between 1 and 255),event_type text not null check(char_length(event_type) between 1 and 150),event_created_at timestamptz not null,processed_at timestamptz not null default now(),result text not null check(result in('applied','ignored')));
alter table public.stripe_webhook_events enable row level security; grant select,insert,update on public.stripe_webhook_events to service_role;
create or replace function public.apply_cloud_ai_subscription_event(p_event_id text,p_event_type text,p_event_created_at timestamptz,p_profile_id uuid,p_plan_key text,p_status text,p_period_starts_at timestamptz,p_period_ends_at timestamptz,p_stripe_customer_id text,p_stripe_subscription_id text) returns boolean language plpgsql security definer set search_path=public as $$ declare v_ent public.cloud_ai_entitlements%rowtype; begin if auth.role()<>'service_role' then raise exception 'stripe_entitlement_not_authorized'; end if; if char_length(p_event_id) not between 1 and 255 or char_length(p_event_type) not between 1 and 150 or p_plan_key not in('trial','creator') or p_status not in('active','trialing','past_due','canceled') or p_period_ends_at<=p_period_starts_at or nullif(trim(p_stripe_customer_id),'') is null or nullif(trim(p_stripe_subscription_id),'') is null then raise exception 'stripe_entitlement_input_invalid'; end if; if exists(select 1 from public.stripe_webhook_events where event_id=p_event_id) then return false; end if; select * into v_ent from public.cloud_ai_entitlements where profile_id=p_profile_id for update; if not found then raise exception 'stripe_entitlement_profile_not_found'; end if; if v_ent.source='stripe' and v_ent.stripe_event_created_at is not null and v_ent.stripe_event_created_at>=p_event_created_at then insert into public.stripe_webhook_events(event_id,event_type,event_created_at,result) values(p_event_id,p_event_type,p_event_created_at,'ignored'); return false; end if; update public.cloud_ai_entitlements set plan_key=p_plan_key,status=p_status,source='stripe',period_starts_at=p_period_starts_at,period_ends_at=p_period_ends_at,stripe_customer_id=trim(p_stripe_customer_id),stripe_subscription_id=trim(p_stripe_subscription_id),stripe_event_created_at=p_event_created_at,updated_at=now() where profile_id=p_profile_id; insert into public.cloud_ai_usage_periods(profile_id,period_starts_at,period_ends_at,plan_key) values(p_profile_id,p_period_starts_at,p_period_ends_at,p_plan_key) on conflict(profile_id,period_starts_at) do update set period_ends_at=excluded.period_ends_at,plan_key=excluded.plan_key,updated_at=now(); insert into public.stripe_webhook_events(event_id,event_type,event_created_at,result) values(p_event_id,p_event_type,p_event_created_at,'applied'); return true; end $$;
revoke execute on function public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text) from public,anon,authenticated; grant execute on function public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text) to service_role;
alter table public.orders add column if not exists buyer_profile_id uuid references public.profiles(id) on delete set null,add column if not exists paid_at timestamptz,add column if not exists download_count integer not null default 0 check(download_count>=0),add column if not exists last_download_at timestamptz;
create index if not exists orders_buyer_paid_idx on public.orders(buyer_profile_id,paid_at desc) where buyer_profile_id is not null and status='paid';
alter table public.orders enable row level security; grant select on public.orders to authenticated; grant select,update on public.orders to service_role; drop policy if exists "orders_buyer_read" on public.orders; create policy "orders_buyer_read" on public.orders for select using(buyer_profile_id=public.current_profile_id() and status in('paid','refunded'));
drop policy if exists "orders_public_pending_insert" on public.orders; create policy "orders_public_pending_insert" on public.orders for insert with check(status='pending' and (buyer_profile_id is null or buyer_profile_id=public.current_profile_id()) and amount>=0 and platform_fee=floor(amount*0.2)::integer and creator_revenue=amount-platform_fee and exists(select 1 from public.digital_products join public.works on works.id=digital_products.work_id where digital_products.id=orders.product_id and digital_products.creator_id=orders.creator_id and digital_products.price=orders.amount and digital_products.status='active' and works.is_public=true and works.content_class='general'));
create or replace function public.record_order_download(p_order_id uuid,p_buyer_profile_id uuid) returns boolean language plpgsql security definer set search_path=public as $$ declare affected integer; begin update public.orders set download_count=download_count+1,last_download_at=now() where id=p_order_id and buyer_profile_id=p_buyer_profile_id and status='paid'; get diagnostics affected=row_count; return affected=1; end $$;
revoke all on function public.record_order_download(uuid,uuid) from public,anon,authenticated; grant execute on function public.record_order_download(uuid,uuid) to service_role;
create or replace function public.sync_cloud_marketplace_draft(p_project_id uuid,p_expected_revision bigint,p_cover_url text,p_product_path text,p_price integer,p_sales_description text) returns table(work_id uuid,product_id uuid) language plpgsql security definer set search_path=public as $$ declare v_profile_id uuid:=public.current_profile_id();v_project public.cloud_projects%rowtype;v_work_id uuid;v_work_status text;v_work_public boolean;v_product_id uuid;v_product_status text;v_count integer;begin if v_profile_id is null then raise exception 'cloud_marketplace_auth_required';end if;if p_price<0 or p_price>1000000 or nullif(trim(p_cover_url),'') is null or nullif(trim(p_product_path),'') is null or char_length(p_sales_description)>5000 then raise exception 'cloud_marketplace_input_invalid';end if;perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));select * into v_project from public.cloud_projects where id=p_project_id and owner_profile_id=v_profile_id and content_class='general' and deleted_at is null for update;if not found then raise exception 'cloud_marketplace_project_not_found';end if;if v_project.revision<>p_expected_revision then raise exception 'cloud_marketplace_revision_conflict';end if;select count(*) into v_count from public.works where creator_id=v_profile_id and source_project_id=p_project_id;if v_count>1 then raise exception 'cloud_marketplace_duplicate_works';end if;select id,status,is_public into v_work_id,v_work_status,v_work_public from public.works where creator_id=v_profile_id and source_project_id=p_project_id order by id limit 1 for update;if v_work_public or v_work_status='published' then raise exception 'cloud_marketplace_work_published';end if;if v_work_id is not null then select count(*) into v_count from public.digital_products dp where dp.creator_id=v_profile_id and dp.work_id=v_work_id;if v_count>1 then raise exception 'cloud_marketplace_duplicate_products';end if;select id,status into v_product_id,v_product_status from public.digital_products dp where dp.creator_id=v_profile_id and dp.work_id=v_work_id order by id limit 1 for update;if v_product_status='active' then raise exception 'cloud_marketplace_product_active';end if;end if;if v_work_id is null then v_work_id:=gen_random_uuid();execute 'insert into public.works(id,creator_id,title,description,image_url,sample_image_urls,source_project_id,content_class,tags,status,is_public) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)' using v_work_id,v_profile_id,v_project.title,v_project.description,p_cover_url,array[]::text[],p_project_id,'general',array['漫画',v_project.age_rating],'draft',false;else execute 'update public.works set title=$1,description=$2,image_url=$3,sample_image_urls=$4,content_class=$5,tags=$6,status=$7,is_public=$8,updated_at=now() where id=$9' using v_project.title,v_project.description,p_cover_url,array[]::text[],'general',array['漫画',v_project.age_rating],'draft',false,v_work_id;end if;if v_product_id is null then v_product_id:=gen_random_uuid();execute 'insert into public.digital_products(id,work_id,creator_id,title,description,file_url,price,status) values($1,$2,$3,$4,$5,$6,$7,$8)' using v_product_id,v_work_id,v_profile_id,v_project.title||' デジタル版',p_sales_description,p_product_path,p_price,'paused';else execute 'update public.digital_products set title=$1,description=$2,file_url=$3,price=$4,status=$5,updated_at=now() where id=$6' using v_project.title||' デジタル版',p_sales_description,p_product_path,p_price,'paused',v_product_id;end if;return query select v_work_id,v_product_id;end $$;
revoke all on function public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text) from public,anon;grant execute on function public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text) to authenticated,service_role;
create table if not exists public.cloud_ai_admin_audit_logs(id uuid primary key default gen_random_uuid(),actor_profile_id uuid not null references public.profiles(id) on delete restrict,action text not null check(char_length(action) between 1 and 100),target_type text not null check(char_length(target_type) between 1 and 100),target_id text not null check(char_length(target_id) between 1 and 255),before_value jsonb,after_value jsonb,created_at timestamptz not null default now());
create index if not exists cloud_ai_admin_audit_created_idx on public.cloud_ai_admin_audit_logs(created_at desc);alter table public.cloud_ai_admin_audit_logs enable row level security;grant select,insert on public.cloud_ai_admin_audit_logs to service_role;
create table if not exists public.cloud_ai_notifications(id uuid primary key default gen_random_uuid(),audience text not null check(audience in('user','admin')),profile_id uuid references public.profiles(id) on delete cascade,notification_type text not null check(notification_type in('quota_warning','job_failed','budget_warning','generation_stopped')),severity text not null check(severity in('info','warning','critical')),title text not null check(char_length(title) between 1 and 200),body text not null check(char_length(body) between 1 and 1000),source_id text,dedupe_key text not null unique check(char_length(dedupe_key) between 1 and 300),read_at timestamptz,created_at timestamptz not null default now(),check((audience='user' and profile_id is not null) or(audience='admin' and profile_id is null)));
create index if not exists cloud_ai_notifications_profile_idx on public.cloud_ai_notifications(profile_id,created_at desc) where profile_id is not null;create index if not exists cloud_ai_notifications_admin_idx on public.cloud_ai_notifications(created_at desc) where audience='admin';alter table public.cloud_ai_notifications enable row level security;grant select on public.cloud_ai_notifications to authenticated;grant update(read_at) on public.cloud_ai_notifications to authenticated;grant select,insert,update on public.cloud_ai_notifications to service_role;drop policy if exists "cloud_ai_notifications_user_read" on public.cloud_ai_notifications;create policy "cloud_ai_notifications_user_read" on public.cloud_ai_notifications for select using(profile_id=public.current_profile_id());drop policy if exists "cloud_ai_notifications_user_update" on public.cloud_ai_notifications;create policy "cloud_ai_notifications_user_update" on public.cloud_ai_notifications for update using(profile_id=public.current_profile_id()) with check(profile_id=public.current_profile_id());
create or replace function public.refresh_cloud_ai_notifications() returns integer language plpgsql security definer set search_path=public as $$ declare v_before bigint;v_settings public.cloud_ai_settings%rowtype;v_daily public.cloud_ai_daily_costs%rowtype;begin if auth.role()<>'service_role' then raise exception 'cloud_notification_refresh_not_authorized';end if;select count(*) into v_before from public.cloud_ai_notifications;select * into v_settings from public.cloud_ai_settings where singleton;select * into v_daily from public.cloud_ai_daily_costs where usage_date=current_date;if found and v_settings.daily_cost_limit_micros>0 and(v_daily.cost_actual_micros+v_daily.cost_reserved_micros)*100>=v_settings.daily_cost_limit_micros*v_settings.warning_percent then insert into public.cloud_ai_notifications(audience,notification_type,severity,title,body,source_id,dedupe_key) values('admin','budget_warning','warning','Cloud AI日次予算警告','実費と予約原価が設定した警告率へ到達しました。',current_date::text,'admin:budget:'||current_date) on conflict(dedupe_key) do nothing;end if;if not v_settings.generation_enabled then insert into public.cloud_ai_notifications(audience,notification_type,severity,title,body,source_id,dedupe_key) values('admin','generation_stopped','critical','Cloud AI生成停止中','全体kill switchまたは日次予算自動停止により生成が停止しています。','global','admin:stopped:'||extract(epoch from v_settings.updated_at)::bigint) on conflict(dedupe_key) do nothing;end if;insert into public.cloud_ai_notifications(audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key) select 'user',j.created_by_profile_id,'job_failed','warning','AI生成に失敗しました',coalesce(nullif(j.error_message,''),'生成Jobを完了できませんでした。'),j.id::text,'user:job-failed:'||j.id from public.cloud_generation_jobs j where j.status='failed' and j.finished_at>=now()-interval '30 days' on conflict(dedupe_key) do nothing;insert into public.cloud_ai_notifications(audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key) select 'user',u.profile_id,'quota_warning','warning','Cloud AI利用枠が少なくなっています','使用済み・予約済みcreditがPlan上限の警告率へ到達しました。',u.period_starts_at::text,'user:quota:'||u.profile_id||':'||extract(epoch from u.period_starts_at)::bigint from public.cloud_ai_usage_periods u join public.cloud_ai_plans p on p.plan_key=u.plan_key where p.monthly_credits>0 and(u.credits_used+u.credits_reserved)*100>=p.monthly_credits*v_settings.warning_percent on conflict(dedupe_key) do nothing;return(select count(*) from public.cloud_ai_notifications)-v_before;end $$;
revoke all on function public.refresh_cloud_ai_notifications() from public,anon,authenticated;grant execute on function public.refresh_cloud_ai_notifications() to service_role;

do $$ begin if to_regprocedure('vault.create_secret(text,text,text)') is null then execute 'create extension if not exists supabase_vault with schema vault';end if;end $$;
create table if not exists public.cloud_research_ai_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false,model text not null default 'gpt-5.6-terra' check(model in('gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna')),secret_id uuid,updated_by_profile_id uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now());
insert into public.cloud_research_ai_settings(singleton,enabled,model) values(true,false,'gpt-5.6-terra') on conflict(singleton) do nothing;
create table if not exists public.cloud_research_ai_audit_logs(id uuid primary key default gen_random_uuid(),actor_profile_id uuid not null references public.profiles(id) on delete restrict,action text not null check(action in('configure','replace_key','enable','disable')),model text not null check(model in('gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna')),enabled boolean not null,created_at timestamptz not null default now());
create index if not exists cloud_research_ai_audit_created_idx on public.cloud_research_ai_audit_logs(created_at desc);
alter table public.cloud_research_ai_settings enable row level security;alter table public.cloud_research_ai_audit_logs enable row level security;
grant select on public.cloud_research_ai_settings,public.cloud_research_ai_audit_logs to authenticated;grant select,insert,update,delete on public.cloud_research_ai_settings to service_role;grant select,insert on public.cloud_research_ai_audit_logs to service_role;
drop policy if exists "cloud_research_ai_settings_admin_read" on public.cloud_research_ai_settings;create policy "cloud_research_ai_settings_admin_read" on public.cloud_research_ai_settings for select using(public.is_admin());
drop policy if exists "cloud_research_ai_audit_admin_read" on public.cloud_research_ai_audit_logs;create policy "cloud_research_ai_audit_admin_read" on public.cloud_research_ai_audit_logs for select using(public.is_admin());
create or replace function public.set_cloud_research_ai_provider(p_actor_profile_id uuid,p_api_key text,p_model text,p_enabled boolean) returns void language plpgsql security definer set search_path=public,vault as $$ declare v_settings public.cloud_research_ai_settings%rowtype;v_secret_id uuid;v_action text;v_api_key text:=nullif(btrim(coalesce(p_api_key,'')),'');begin if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_research_ai_admin_required';end if;if p_model not in('gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna') then raise exception 'cloud_research_ai_model_invalid';end if;if v_api_key is not null and(char_length(v_api_key)<20 or char_length(v_api_key)>500 or v_api_key!~'^sk-') then raise exception 'cloud_research_ai_key_invalid';end if;select * into v_settings from public.cloud_research_ai_settings where singleton=true for update;v_secret_id:=v_settings.secret_id;if v_api_key is not null then if v_secret_id is null then v_secret_id:=vault.create_secret(v_api_key,'mangai_cloud_research_openai','MANGAI Cloud market research OpenAI API key');v_action:='configure';else perform vault.update_secret(v_secret_id,v_api_key,'mangai_cloud_research_openai','MANGAI Cloud market research OpenAI API key');v_action:='replace_key';end if;elsif p_enabled and v_secret_id is null then raise exception 'cloud_research_ai_key_required';else v_action:=case when p_enabled then 'enable' else 'disable' end;end if;update public.cloud_research_ai_settings set enabled=p_enabled,model=p_model,secret_id=v_secret_id,updated_by_profile_id=p_actor_profile_id,updated_at=now() where singleton=true;insert into public.cloud_research_ai_audit_logs(actor_profile_id,action,model,enabled) values(p_actor_profile_id,v_action,p_model,p_enabled);end $$;
create or replace function public.get_cloud_research_ai_runtime_config() returns table(enabled boolean,model text,api_key text) language plpgsql security definer set search_path=public,vault as $$ begin if auth.role()<>'service_role' then raise exception 'cloud_research_ai_service_role_required';end if;return query select settings.enabled,settings.model,secrets.decrypted_secret from public.cloud_research_ai_settings settings left join vault.decrypted_secrets secrets on secrets.id=settings.secret_id where settings.singleton=true;end $$;
revoke all on function public.set_cloud_research_ai_provider(uuid,text,text,boolean) from public,anon,authenticated;revoke all on function public.get_cloud_research_ai_runtime_config() from public,anon,authenticated;grant execute on function public.set_cloud_research_ai_provider(uuid,text,text,boolean) to service_role;grant execute on function public.get_cloud_research_ai_runtime_config() to service_role;

create table if not exists public.cloud_story_proposal_runs(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,status text not null check(status='completed'),result jsonb not null check(jsonb_typeof(result)='object' and result->>'engineVersion'='openai-proposal-v1' and result->>'classification'='ai_inference' and result->>'containsGeneratedMarketNumbers'='false' and jsonb_typeof(result->'candidates')='array' and jsonb_array_length(result->'candidates')=3 and pg_column_size(result)<=131072),engine_version text not null check(engine_version='openai-proposal-v1'),completed_at timestamptz not null,created_at timestamptz not null default now());
create index if not exists cloud_story_proposal_runs_owner_idx on public.cloud_story_proposal_runs(owner_profile_id,created_at desc);create index if not exists cloud_story_proposal_runs_report_idx on public.cloud_story_proposal_runs(research_report_id,created_at desc);alter table public.cloud_story_proposal_runs enable row level security;grant select,insert on public.cloud_story_proposal_runs to authenticated;grant select,insert,delete on public.cloud_story_proposal_runs to service_role;
drop policy if exists "cloud_story_proposal_runs_owner_read" on public.cloud_story_proposal_runs;create policy "cloud_story_proposal_runs_owner_read" on public.cloud_story_proposal_runs for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_story_proposal_runs_owner_insert" on public.cloud_story_proposal_runs;create policy "cloud_story_proposal_runs_owner_insert" on public.cloud_story_proposal_runs for insert with check(owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_market_research_reports report where report.id=research_report_id and report.owner_profile_id=public.current_profile_id() and report.status='completed' and report.input->>'contentClass'='general'));
create table if not exists public.cloud_story_proposal_selections(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,proposal_run_id uuid not null references public.cloud_story_proposal_runs(id) on delete restrict,candidate_id text not null check(candidate_id in('candidate-best-fit','candidate-differentiated','candidate-lean-test')),candidate_snapshot jsonb not null check(jsonb_typeof(candidate_snapshot)='object' and candidate_snapshot->>'id'=candidate_id and pg_column_size(candidate_snapshot)<=32768),selected_at timestamptz not null default now(),unique(research_report_id));
create index if not exists cloud_story_proposal_selections_owner_idx on public.cloud_story_proposal_selections(owner_profile_id,selected_at desc);alter table public.cloud_story_proposal_selections enable row level security;grant select,insert on public.cloud_story_proposal_selections to authenticated;grant select,insert,delete on public.cloud_story_proposal_selections to service_role;
drop policy if exists "cloud_story_proposal_selections_owner_read" on public.cloud_story_proposal_selections;create policy "cloud_story_proposal_selections_owner_read" on public.cloud_story_proposal_selections for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_story_proposal_selections_owner_insert" on public.cloud_story_proposal_selections;create policy "cloud_story_proposal_selections_owner_insert" on public.cloud_story_proposal_selections for insert with check(owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_story_proposal_runs run where run.id=proposal_run_id and run.owner_profile_id=public.current_profile_id() and run.research_report_id=research_report_id and exists(select 1 from jsonb_array_elements(run.result->'candidates') candidate where candidate->>'id'=candidate_id and candidate=candidate_snapshot)));

create table if not exists public.cloud_story_scenario_versions(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,research_report_id uuid not null references public.cloud_market_research_reports(id) on delete restrict,proposal_selection_id uuid not null references public.cloud_story_proposal_selections(id) on delete restrict,parent_version_id uuid references public.cloud_story_scenario_versions(id) on delete restrict,revision_instruction text check(revision_instruction is null or char_length(revision_instruction) between 1 and 2000),result jsonb not null check(jsonb_typeof(result)='object' and result->>'engineVersion'='openai-scenario-v1' and result->>'classification'='ai_inference' and result->>'containsGeneratedMarketNumbers'='false' and jsonb_typeof(result->'characters')='array' and jsonb_typeof(result->'acts')='array' and jsonb_array_length(result->'acts')=3 and jsonb_typeof(result->'scenes')='array' and jsonb_array_length(result->'scenes') between 6 and 20 and pg_column_size(result)<=262144),engine_version text not null check(engine_version='openai-scenario-v1'),completed_at timestamptz not null,created_at timestamptz not null default now(),check((parent_version_id is null and revision_instruction is null) or(parent_version_id is not null and revision_instruction is not null)));
create index if not exists cloud_story_scenario_versions_owner_idx on public.cloud_story_scenario_versions(owner_profile_id,created_at desc);create index if not exists cloud_story_scenario_versions_selection_idx on public.cloud_story_scenario_versions(proposal_selection_id,created_at desc);alter table public.cloud_story_scenario_versions enable row level security;grant select,insert on public.cloud_story_scenario_versions to authenticated;grant select,insert,delete on public.cloud_story_scenario_versions to service_role;
drop policy if exists "cloud_story_scenario_versions_owner_read" on public.cloud_story_scenario_versions;create policy "cloud_story_scenario_versions_owner_read" on public.cloud_story_scenario_versions for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_story_scenario_versions_owner_insert" on public.cloud_story_scenario_versions;create policy "cloud_story_scenario_versions_owner_insert" on public.cloud_story_scenario_versions for insert with check(owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_story_proposal_selections selection join public.cloud_market_research_reports report on report.id=selection.research_report_id where selection.id=proposal_selection_id and selection.owner_profile_id=public.current_profile_id() and selection.research_report_id=research_report_id and report.owner_profile_id=public.current_profile_id() and report.input->>'contentClass'='general') and(parent_version_id is null or exists(select 1 from public.cloud_story_scenario_versions parent where parent.id=parent_version_id and parent.owner_profile_id=public.current_profile_id() and parent.proposal_selection_id=proposal_selection_id)));
create table if not exists public.cloud_story_scenario_adoptions(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,proposal_selection_id uuid not null references public.cloud_story_proposal_selections(id) on delete restrict,scenario_version_id uuid not null references public.cloud_story_scenario_versions(id) on delete restrict,adopted_at timestamptz not null default now(),unique(proposal_selection_id,scenario_version_id));
create index if not exists cloud_story_scenario_adoptions_owner_idx on public.cloud_story_scenario_adoptions(owner_profile_id,adopted_at desc);create index if not exists cloud_story_scenario_adoptions_selection_idx on public.cloud_story_scenario_adoptions(proposal_selection_id,adopted_at desc);alter table public.cloud_story_scenario_adoptions enable row level security;grant select,insert on public.cloud_story_scenario_adoptions to authenticated;grant select,insert,delete on public.cloud_story_scenario_adoptions to service_role;
drop policy if exists "cloud_story_scenario_adoptions_owner_read" on public.cloud_story_scenario_adoptions;create policy "cloud_story_scenario_adoptions_owner_read" on public.cloud_story_scenario_adoptions for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_story_scenario_adoptions_owner_insert" on public.cloud_story_scenario_adoptions;create policy "cloud_story_scenario_adoptions_owner_insert" on public.cloud_story_scenario_adoptions for insert with check(owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_story_scenario_versions version where version.id=scenario_version_id and version.owner_profile_id=public.current_profile_id() and version.proposal_selection_id=proposal_selection_id));

create table if not exists public.cloud_story_storyboard_versions(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,scenario_version_id uuid not null references public.cloud_story_scenario_versions(id) on delete restrict,parent_version_id uuid references public.cloud_story_storyboard_versions(id) on delete restrict,revision_instruction text check(revision_instruction is null or char_length(revision_instruction) between 1 and 2000),result jsonb not null check(jsonb_typeof(result)='object' and result->>'engineVersion'='openai-storyboard-v1' and result->>'classification'='ai_inference' and result->>'containsGeneratedMarketNumbers'='false' and result->>'readingDirection'='rtl' and jsonb_typeof(result->'pages')='array' and jsonb_array_length(result->'pages') between 8 and 48 and pg_column_size(result)<=1048576),engine_version text not null check(engine_version='openai-storyboard-v1'),completed_at timestamptz not null,created_at timestamptz not null default now(),check((parent_version_id is null and revision_instruction is null) or(parent_version_id is not null and revision_instruction is not null)));
create index if not exists cloud_story_storyboard_versions_owner_idx on public.cloud_story_storyboard_versions(owner_profile_id,created_at desc);create index if not exists cloud_story_storyboard_versions_scenario_idx on public.cloud_story_storyboard_versions(scenario_version_id,created_at desc);alter table public.cloud_story_storyboard_versions enable row level security;grant select,insert on public.cloud_story_storyboard_versions to authenticated;grant select,insert,delete on public.cloud_story_storyboard_versions to service_role;
drop policy if exists "cloud_story_storyboard_versions_owner_read" on public.cloud_story_storyboard_versions;create policy "cloud_story_storyboard_versions_owner_read" on public.cloud_story_storyboard_versions for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_story_storyboard_versions_owner_insert" on public.cloud_story_storyboard_versions;create policy "cloud_story_storyboard_versions_owner_insert" on public.cloud_story_storyboard_versions for insert with check(owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_story_scenario_versions scenario where scenario.id=scenario_version_id and scenario.owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_story_scenario_adoptions adoption where adoption.scenario_version_id=scenario.id and adoption.owner_profile_id=public.current_profile_id() and not exists(select 1 from public.cloud_story_scenario_adoptions newer where newer.proposal_selection_id=adoption.proposal_selection_id and(newer.adopted_at,newer.id)>(adoption.adopted_at,adoption.id)))) and(parent_version_id is null or exists(select 1 from public.cloud_story_storyboard_versions parent where parent.id=parent_version_id and parent.owner_profile_id=public.current_profile_id() and parent.scenario_version_id=scenario_version_id)));
create table if not exists public.cloud_story_storyboard_adoptions(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,scenario_version_id uuid not null references public.cloud_story_scenario_versions(id) on delete restrict,storyboard_version_id uuid not null references public.cloud_story_storyboard_versions(id) on delete restrict,adopted_at timestamptz not null default now(),unique(scenario_version_id,storyboard_version_id));
create index if not exists cloud_story_storyboard_adoptions_owner_idx on public.cloud_story_storyboard_adoptions(owner_profile_id,adopted_at desc);create index if not exists cloud_story_storyboard_adoptions_scenario_idx on public.cloud_story_storyboard_adoptions(scenario_version_id,adopted_at desc);alter table public.cloud_story_storyboard_adoptions enable row level security;grant select,insert on public.cloud_story_storyboard_adoptions to authenticated;grant select,insert,delete on public.cloud_story_storyboard_adoptions to service_role;
drop policy if exists "cloud_story_storyboard_adoptions_owner_read" on public.cloud_story_storyboard_adoptions;create policy "cloud_story_storyboard_adoptions_owner_read" on public.cloud_story_storyboard_adoptions for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_story_storyboard_adoptions_owner_insert" on public.cloud_story_storyboard_adoptions;create policy "cloud_story_storyboard_adoptions_owner_insert" on public.cloud_story_storyboard_adoptions for insert with check(owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_story_storyboard_versions version where version.id=storyboard_version_id and version.owner_profile_id=public.current_profile_id() and version.scenario_version_id=scenario_version_id));

create table if not exists public.cloud_story_storyboard_projects(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,storyboard_version_id uuid not null unique references public.cloud_story_storyboard_versions(id) on delete restrict,project_id uuid not null unique references public.cloud_projects(id) on delete cascade,first_page_id uuid not null,created_at timestamptz not null default now(),foreign key(first_page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade);
create index if not exists cloud_story_storyboard_projects_owner_idx on public.cloud_story_storyboard_projects(owner_profile_id,created_at desc);
alter table public.cloud_story_storyboard_projects enable row level security;
grant select on public.cloud_story_storyboard_projects to authenticated;grant select,insert,delete on public.cloud_story_storyboard_projects to service_role;
drop policy if exists "cloud_story_storyboard_projects_owner_read" on public.cloud_story_storyboard_projects;create policy "cloud_story_storyboard_projects_owner_read" on public.cloud_story_storyboard_projects for select using(owner_profile_id=public.current_profile_id());

create or replace function public.build_cloud_storyboard_canvas(p_page_id uuid,p_width integer,p_height integer,p_storyboard_page jsonb) returns jsonb language sql volatile set search_path=public,pg_temp as $$
with raw_panels as (
  select panel,ordinality::integer as panel_index,jsonb_array_length(p_storyboard_page->'panels')::integer as panel_count
  from jsonb_array_elements(p_storyboard_page->'panels') with ordinality as value(panel,ordinality)
),grid as (
  select raw_panels.*,gen_random_uuid() as panel_id,case when panel_count=1 then 1 else 2 end as column_count,case when panel_count=1 then 1 else (panel_count+1)/2 end as row_count
  from raw_panels
),geometry as (
  select grid.*,(p_width-96-24*(column_count-1))::numeric/column_count as panel_width,(p_height-144-24*(row_count-1))::numeric/row_count as panel_height,48+(column_count-1-((panel_index-1)%column_count))*((p_width-96-24*(column_count-1))::numeric/column_count+24) as panel_x,72+floor((panel_index-1)::numeric/column_count)*((p_height-144-24*(row_count-1))::numeric/row_count+24) as panel_y
  from grid
),dialogues as (
  select geometry.*,dialogue,dialogue_index::integer,gen_random_uuid() as balloon_id
  from geometry cross join lateral jsonb_array_elements(coalesce(panel->'dialogue','[]'::jsonb)) with ordinality as line(dialogue,dialogue_index)
),panel_output as (
  select coalesce(jsonb_agg(jsonb_build_object('id',panel_id,'pageId',p_page_id,'name','コマ'||panel_index,'x',panel_x,'y',panel_y,'width',panel_width,'height',panel_height,'rotation',0,'zIndex',panel_index-1,'visible',true,'locked',false,'borderColor','#111111','borderWidth',4,'fillColor','#fafafa','shape','rectangle','slant',0,'imageAssetId',null,'imageFit','cover','imageOffsetX',0,'imageOffsetY',0,'imageScale',1,'imageRotation',0,'imageOpacity',1,'createdAt','','updatedAt','') order by panel_index),'[]'::jsonb) as value from geometry
),balloon_output as (
  select coalesce(jsonb_agg(jsonb_build_object('id',balloon_id,'pageId',p_page_id,'name',coalesce(dialogue->>'speaker','セリフ')||' '||dialogue_index,'type',case dialogue->>'type' when 'narration' then 'narration_box' when 'thought' then 'speech_rounded' else 'speech_ellipse' end,'x',panel_x+greatest(16,panel_width*0.08),'y',panel_y+12+(dialogue_index-1)*(panel_height-24)/4,'width',greatest(120,panel_width*0.58),'height',greatest(72,least(180,(panel_height-24)/4-8)),'rotation',0,'zIndex',100+(panel_index-1)*10+(dialogue_index-1)*2,'visible',true,'locked',false,'fillColor','#ffffff','strokeColor','#111111','strokeWidth',3,'opacity',0.94,'tailDirection',case when dialogue->>'type'='narration' then 'none' else 'bottom_right' end,'tailOffset',0.5,'createdAt','','updatedAt','') order by panel_index,dialogue_index),'[]'::jsonb) as value from dialogues
),text_output as (
  select coalesce(jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'pageId',p_page_id,'parentBalloonId',balloon_id,'name',coalesce(dialogue->>'speaker','セリフ')||' テキスト','text',dialogue->>'text','x',panel_x+greatest(16,panel_width*0.08)+18,'y',panel_y+30+(dialogue_index-1)*(panel_height-24)/4,'width',greatest(80,panel_width*0.58-36),'height',greatest(40,least(144,(panel_height-24)/4-44)),'rotation',0,'zIndex',101+(panel_index-1)*10+(dialogue_index-1)*2,'visible',true,'locked',false,'writingMode','vertical','fontFamily','sans-serif','fontSize',42,'fontWeight',500,'color','#111111','textAlign','start','verticalAlign','top','lineHeight',1.45,'letterSpacing',0,'padding',8,'opacity',1,'createdAt','','updatedAt','') order by panel_index,dialogue_index),'[]'::jsonb) as value from dialogues
)
select jsonb_build_object('schemaVersion',1,'pageId',p_page_id,'width',p_width,'height',p_height,'backgroundColor','#ffffff','panels',panel_output.value,'panelLayers','[]'::jsonb,'balloons',balloon_output.value,'textObjects',text_output.value)
from panel_output,balloon_output,text_output;
$$;
revoke execute on function public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb) from public,anon,authenticated;

create or replace function public.materialize_cloud_storyboard_project(p_storyboard_version_id uuid) returns table(project_id uuid,first_page_id uuid,was_created boolean) language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile_id uuid:=public.current_profile_id();v_existing public.cloud_story_storyboard_projects%rowtype;v_storyboard_id uuid;v_storyboard_scenario_id uuid;v_storyboard_result jsonb;v_episode_id uuid;v_project_id uuid;v_page_id uuid;v_first_page_id uuid;v_page jsonb;v_page_index integer:=0;v_content_class text;v_revision bigint;
begin
  if v_profile_id is null then raise exception 'profile_required';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_storyboard_version_id::text,0));
  select * into v_existing from public.cloud_story_storyboard_projects where storyboard_version_id=p_storyboard_version_id and owner_profile_id=v_profile_id;
  if found then project_id:=v_existing.project_id;first_page_id:=v_existing.first_page_id;was_created:=false;return next;return;end if;
  select storyboard.id,storyboard.scenario_version_id,storyboard.result,report.input->>'contentClass' into v_storyboard_id,v_storyboard_scenario_id,v_storyboard_result,v_content_class from public.cloud_story_storyboard_versions storyboard join public.cloud_story_scenario_versions scenario on scenario.id=storyboard.scenario_version_id join public.cloud_market_research_reports report on report.id=scenario.research_report_id where storyboard.id=p_storyboard_version_id and storyboard.owner_profile_id=v_profile_id;
  if not found or v_content_class is distinct from 'general' then raise exception 'general_adopted_storyboard_required';end if;
  if not exists(select 1 from public.cloud_story_storyboard_adoptions adoption where adoption.storyboard_version_id=v_storyboard_id and adoption.owner_profile_id=v_profile_id and not exists(select 1 from public.cloud_story_storyboard_adoptions newer where newer.scenario_version_id=adoption.scenario_version_id and(newer.adopted_at,newer.id)>(adoption.adopted_at,adoption.id))) then raise exception 'latest_adopted_storyboard_required';end if;
  select created.project_id,created.episode_id,created.page_id into v_project_id,v_episode_id,v_page_id from public.create_cloud_project_with_first_page(v_storyboard_result->>'title','採用AIネームから作成した編集用Canvas下書きです。画像は未生成です。','全年齢','rtl',1600,2400,300) created;
  v_first_page_id:=v_page_id;
  for v_page in select value from jsonb_array_elements(v_storyboard_result->'pages') value order by(value->>'pageNumber')::integer loop
    v_page_index:=v_page_index+1;
    if v_page_index>1 then select public.add_cloud_page(v_episode_id) into v_page_id;end if;
    update public.cloud_canvas_snapshots set canvas=public.build_cloud_storyboard_canvas(v_page_id,1600,2400,v_page) where page_id=v_page_id and revision=0;
  end loop;
  if v_page_index<>jsonb_array_length(v_storyboard_result->'pages') or v_page_index<>(v_storyboard_result->>'pageCount')::integer then raise exception 'storyboard_page_count_mismatch';end if;
  update public.cloud_projects project set cover_page_id=v_first_page_id,revision=revision+1,updated_at=now() where project.id=v_project_id returning project.revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_project_id,v_revision,jsonb_build_object('event','storyboard_materialized','storyboardVersionId',v_storyboard_id,'pageCount',v_page_index),v_profile_id);
  insert into public.cloud_story_storyboard_projects(owner_profile_id,storyboard_version_id,project_id,first_page_id) values(v_profile_id,v_storyboard_id,v_project_id,v_first_page_id);
  project_id:=v_project_id;first_page_id:=v_first_page_id;was_created:=true;return next;
end;
$$;
revoke execute on function public.materialize_cloud_storyboard_project(uuid) from public,anon;
grant execute on function public.materialize_cloud_storyboard_project(uuid) to authenticated,service_role;

-- General monitor beta: invitation, cumulative AI cap and owner feedback.
create table if not exists public.cloud_general_monitor_enrollments(profile_id uuid primary key references public.profiles(id) on delete cascade,status text not null check(status in('active','paused','completed','revoked')),cohort text not null default 'general-preview-01' check(char_length(cohort) between 1 and 80),ai_request_limit integer not null default 30 check(ai_request_limit between 1 and 200),ai_requests_used integer not null default 0 check(ai_requests_used between 0 and ai_request_limit),starts_at timestamptz not null default now(),expires_at timestamptz not null,invited_by_profile_id uuid not null references public.profiles(id) on delete restrict,admin_note text check(admin_note is null or char_length(admin_note)<=500),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(expires_at>starts_at));
create table if not exists public.cloud_general_monitor_ai_usage(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(id) on delete cascade,operation text not null check(operation in('research','proposal','scenario','storyboard','panel_image')),created_at timestamptz not null default now());
create table if not exists public.cloud_general_monitor_feedback(id uuid primary key default gen_random_uuid(),owner_profile_id uuid not null references public.profiles(id) on delete cascade,workflow_step text not null check(workflow_step in('overall','research','proposal','scenario','storyboard','canvas','panel_image')),rating integer not null check(rating between 1 and 5),outcome text not null check(outcome in('very_useful','useful','neutral','difficult','blocked')),comment text not null check(char_length(comment) between 1 and 2000),created_at timestamptz not null default now());
create table if not exists public.cloud_general_monitor_audit_logs(id uuid primary key default gen_random_uuid(),actor_profile_id uuid not null references public.profiles(id) on delete restrict,target_profile_id uuid not null references public.profiles(id) on delete restrict,action text not null check(action in('activate','pause','complete','revoke','update')),before_value jsonb,after_value jsonb,created_at timestamptz not null default now());
create index if not exists cloud_general_monitor_status_idx on public.cloud_general_monitor_enrollments(status,expires_at);
create index if not exists cloud_general_monitor_usage_profile_idx on public.cloud_general_monitor_ai_usage(profile_id,created_at desc);
create index if not exists cloud_general_monitor_feedback_profile_idx on public.cloud_general_monitor_feedback(owner_profile_id,created_at desc);
create index if not exists cloud_general_monitor_audit_created_idx on public.cloud_general_monitor_audit_logs(created_at desc);
alter table public.cloud_general_monitor_enrollments enable row level security;alter table public.cloud_general_monitor_ai_usage enable row level security;alter table public.cloud_general_monitor_feedback enable row level security;alter table public.cloud_general_monitor_audit_logs enable row level security;
grant select on public.cloud_general_monitor_enrollments to authenticated;grant select,insert on public.cloud_general_monitor_feedback to authenticated;grant select,insert,update,delete on public.cloud_general_monitor_enrollments,public.cloud_general_monitor_ai_usage,public.cloud_general_monitor_feedback,public.cloud_general_monitor_audit_logs to service_role;
drop policy if exists "cloud_general_monitor_enrollment_owner_read" on public.cloud_general_monitor_enrollments;create policy "cloud_general_monitor_enrollment_owner_read" on public.cloud_general_monitor_enrollments for select using(profile_id=public.current_profile_id() or public.is_admin());
drop policy if exists "cloud_general_monitor_feedback_owner_read" on public.cloud_general_monitor_feedback;create policy "cloud_general_monitor_feedback_owner_read" on public.cloud_general_monitor_feedback for select using(owner_profile_id=public.current_profile_id() or public.is_admin());
drop policy if exists "cloud_general_monitor_feedback_owner_insert" on public.cloud_general_monitor_feedback;create policy "cloud_general_monitor_feedback_owner_insert" on public.cloud_general_monitor_feedback for insert with check(owner_profile_id=public.current_profile_id() and exists(select 1 from public.cloud_general_monitor_enrollments enrollment where enrollment.profile_id=public.current_profile_id() and enrollment.status='active' and enrollment.starts_at<=now() and enrollment.expires_at>now()));
drop policy if exists "cloud_general_monitor_audit_admin_read" on public.cloud_general_monitor_audit_logs;create policy "cloud_general_monitor_audit_admin_read" on public.cloud_general_monitor_audit_logs for select using(public.is_admin());
create or replace function public.can_use_cloud_general_monitor() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.cloud_general_monitor_enrollments enrollment where enrollment.profile_id=public.current_profile_id() and enrollment.status='active' and enrollment.starts_at<=now() and enrollment.expires_at>now());$$;
revoke all on function public.can_use_cloud_general_monitor() from public,anon;grant execute on function public.can_use_cloud_general_monitor() to authenticated,service_role;
create or replace function public.consume_cloud_general_monitor_ai_request(p_profile_id uuid,p_operation text) returns table(requests_used integer,request_limit integer) language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' then raise exception 'cloud_general_monitor_service_required';end if;
  if p_operation not in('research','proposal','scenario','storyboard','panel_image') then raise exception 'cloud_general_monitor_operation_invalid';end if;
  return query update public.cloud_general_monitor_enrollments enrollment set ai_requests_used=enrollment.ai_requests_used+1,updated_at=now() where enrollment.profile_id=p_profile_id and enrollment.status='active' and enrollment.starts_at<=now() and enrollment.expires_at>now() and enrollment.ai_requests_used<enrollment.ai_request_limit returning enrollment.ai_requests_used,enrollment.ai_request_limit;
  if not found then raise exception 'cloud_general_monitor_unavailable';end if;
  insert into public.cloud_general_monitor_ai_usage(profile_id,operation) values(p_profile_id,p_operation);
end;$$;
revoke all on function public.consume_cloud_general_monitor_ai_request(uuid,text) from public,anon,authenticated;grant execute on function public.consume_cloud_general_monitor_ai_request(uuid,text) to service_role;
create or replace function public.activate_cloud_general_monitor(p_actor_profile_id uuid,p_target_profile_id uuid,p_expires_at timestamptz,p_ai_request_limit integer,p_cohort text,p_admin_note text) returns void language plpgsql security definer set search_path=public as $$
declare v_before jsonb;v_after jsonb;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_admin_required';end if;
  if not exists(select 1 from public.profiles where id=p_target_profile_id) or p_expires_at<=now() or p_ai_request_limit not between 1 and 200 or char_length(trim(coalesce(p_cohort,''))) not between 1 and 80 or char_length(coalesce(p_admin_note,''))>500 then raise exception 'cloud_general_monitor_input_invalid';end if;
  select to_jsonb(enrollment) into v_before from public.cloud_general_monitor_enrollments enrollment where enrollment.profile_id=p_target_profile_id;
  insert into public.cloud_general_monitor_enrollments(profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,invited_by_profile_id,admin_note) values(p_target_profile_id,'active',trim(p_cohort),p_ai_request_limit,0,now(),p_expires_at,p_actor_profile_id,nullif(trim(p_admin_note),'')) on conflict(profile_id) do update set status='active',cohort=excluded.cohort,ai_request_limit=excluded.ai_request_limit,ai_requests_used=0,starts_at=now(),expires_at=excluded.expires_at,invited_by_profile_id=excluded.invited_by_profile_id,admin_note=excluded.admin_note,updated_at=now();
  select to_jsonb(enrollment) into v_after from public.cloud_general_monitor_enrollments enrollment where enrollment.profile_id=p_target_profile_id;
  insert into public.cloud_general_monitor_audit_logs(actor_profile_id,target_profile_id,action,before_value,after_value) values(p_actor_profile_id,p_target_profile_id,case when v_before is null then 'activate' else 'update' end,v_before,v_after);
end;$$;
revoke all on function public.activate_cloud_general_monitor(uuid,uuid,timestamptz,integer,text,text) from public,anon,authenticated;grant execute on function public.activate_cloud_general_monitor(uuid,uuid,timestamptz,integer,text,text) to service_role;
create or replace function public.stop_cloud_general_monitor(p_actor_profile_id uuid,p_target_profile_id uuid,p_status text,p_admin_note text) returns void language plpgsql security definer set search_path=public as $$
declare v_before jsonb;v_after jsonb;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_admin_required';end if;
  if p_status not in('paused','completed','revoked') or char_length(trim(coalesce(p_admin_note,''))) not between 1 and 500 then raise exception 'cloud_general_monitor_input_invalid';end if;
  select to_jsonb(enrollment) into v_before from public.cloud_general_monitor_enrollments enrollment where enrollment.profile_id=p_target_profile_id for update;if v_before is null then raise exception 'cloud_general_monitor_not_found';end if;
  update public.cloud_general_monitor_enrollments set status=p_status,admin_note=trim(p_admin_note),updated_at=now() where profile_id=p_target_profile_id;
  select to_jsonb(enrollment) into v_after from public.cloud_general_monitor_enrollments enrollment where enrollment.profile_id=p_target_profile_id;
  insert into public.cloud_general_monitor_audit_logs(actor_profile_id,target_profile_id,action,before_value,after_value) values(p_actor_profile_id,p_target_profile_id,case p_status when 'paused' then 'pause' when 'completed' then 'complete' else 'revoke' end,v_before,v_after);
end;$$;
revoke all on function public.stop_cloud_general_monitor(uuid,uuid,text,text) from public,anon,authenticated;grant execute on function public.stop_cloud_general_monitor(uuid,uuid,text,text) to service_role;

-- General monitor operations: onboarding and feedback triage.
alter table public.cloud_general_monitor_enrollments add column if not exists onboarding_completed_at timestamptz;
alter table public.cloud_general_monitor_feedback add column if not exists review_status text not null default 'new' check(review_status in('new','reviewing','resolved')),add column if not exists admin_note text check(admin_note is null or char_length(admin_note)<=1000),add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,add column if not exists reviewed_at timestamptz;
create index if not exists cloud_general_monitor_feedback_review_idx on public.cloud_general_monitor_feedback(review_status,created_at desc);
create or replace function public.complete_cloud_general_monitor_onboarding() returns void language plpgsql security definer set search_path=public as $$begin update public.cloud_general_monitor_enrollments set onboarding_completed_at=coalesce(onboarding_completed_at,now()),updated_at=now() where profile_id=public.current_profile_id() and status='active' and starts_at<=now() and expires_at>now();if not found then raise exception 'cloud_general_monitor_unavailable';end if;end;$$;
revoke all on function public.complete_cloud_general_monitor_onboarding() from public,anon;grant execute on function public.complete_cloud_general_monitor_onboarding() to authenticated,service_role;
create or replace function public.review_cloud_general_monitor_feedback(p_actor_profile_id uuid,p_feedback_id uuid,p_status text,p_admin_note text) returns void language plpgsql security definer set search_path=public as $$begin if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_admin_required';end if;if p_status not in('new','reviewing','resolved') or char_length(coalesce(p_admin_note,''))>1000 then raise exception 'cloud_general_monitor_input_invalid';end if;update public.cloud_general_monitor_feedback set review_status=p_status,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now() where id=p_feedback_id;if not found then raise exception 'cloud_general_monitor_feedback_not_found';end if;end;$$;
revoke all on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) from public,anon,authenticated;grant execute on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) to service_role;

-- General monitor invitation email Provider settings.
do $$ begin if to_regprocedure('vault.create_secret(text,text,text)') is null then execute 'create extension if not exists supabase_vault with schema vault';end if;end $$;
create table if not exists public.cloud_general_monitor_email_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false,from_email text not null default '' check(char_length(from_email)<=254),from_name text not null default 'MANGAI運営' check(char_length(from_name) between 1 and 80),subject_template text not null default 'MANGAI 一般向けモニターのご案内' constraint cloud_general_monitor_email_subject_template_check check(char_length(subject_template) between 1 and 120 and subject_template!~E'[\r\n]'),body_template text not null default E'{{recipient_name}}\n\nMANGAI一般向けモニターへご招待しました。\n登録済みのメールアドレスでログインし、初回案内をご確認ください。\n\n利用開始: {{welcome_url}}\n利用期限: {{expires_on}}\nAI利用上限: {{ai_request_limit}}回\n\nこのメールへパスワード、APIキー、個人情報を返信しないでください。' constraint cloud_general_monitor_email_body_template_check check(char_length(body_template) between 20 and 5000 and position('{{welcome_url}}' in body_template)>0),secret_id uuid,updated_by_profile_id uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now());
insert into public.cloud_general_monitor_email_settings(singleton,enabled,from_email,from_name) values(true,false,'','MANGAI運営') on conflict(singleton) do nothing;
create table if not exists public.cloud_general_monitor_email_audit_logs(id uuid primary key default gen_random_uuid(),actor_profile_id uuid not null references public.profiles(id) on delete restrict,action text not null constraint cloud_general_monitor_email_audit_logs_action_check check(action in('configure','replace_key','update_template')),from_email text not null,created_at timestamptz not null default now());
alter table public.cloud_general_monitor_email_settings enable row level security;alter table public.cloud_general_monitor_email_audit_logs enable row level security;
grant select on public.cloud_general_monitor_email_settings,public.cloud_general_monitor_email_audit_logs to authenticated;grant select,insert,update,delete on public.cloud_general_monitor_email_settings to service_role;grant select,insert on public.cloud_general_monitor_email_audit_logs to service_role;
drop policy if exists "cloud_general_monitor_email_settings_admin_read" on public.cloud_general_monitor_email_settings;create policy "cloud_general_monitor_email_settings_admin_read" on public.cloud_general_monitor_email_settings for select using(public.is_admin());
drop policy if exists "cloud_general_monitor_email_audit_admin_read" on public.cloud_general_monitor_email_audit_logs;create policy "cloud_general_monitor_email_audit_admin_read" on public.cloud_general_monitor_email_audit_logs for select using(public.is_admin());
create or replace function public.set_cloud_general_monitor_email_provider(p_actor_profile_id uuid,p_api_key text,p_from_email text,p_from_name text,p_enabled boolean) returns void language plpgsql security definer set search_path=public,vault as $$declare v_settings public.cloud_general_monitor_email_settings%rowtype;v_secret_id uuid;v_api_key text:=nullif(btrim(coalesce(p_api_key,'')),'');v_from_email text:=lower(btrim(coalesce(p_from_email,'')));v_from_name text:=btrim(coalesce(p_from_name,''));v_action text;begin if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_email_admin_required';end if;if v_api_key is null or char_length(v_api_key)<20 or char_length(v_api_key)>500 or v_api_key!~'^re_[^[:space:]]+$' or char_length(v_from_email)>254 or v_from_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_from_name) not between 1 and 80 then raise exception 'cloud_general_monitor_email_input_invalid';end if;select * into v_settings from public.cloud_general_monitor_email_settings where singleton=true for update;v_secret_id:=v_settings.secret_id;if v_secret_id is null then v_secret_id:=vault.create_secret(v_api_key,'mangai_general_monitor_resend','MANGAI general monitor Resend API key');v_action:='configure';else perform vault.update_secret(v_secret_id,v_api_key,'mangai_general_monitor_resend','MANGAI general monitor Resend API key');v_action:='replace_key';end if;update public.cloud_general_monitor_email_settings set enabled=p_enabled,from_email=v_from_email,from_name=v_from_name,secret_id=v_secret_id,updated_by_profile_id=p_actor_profile_id,updated_at=now() where singleton=true;insert into public.cloud_general_monitor_email_audit_logs(actor_profile_id,action,from_email) values(p_actor_profile_id,v_action,v_from_email);end $$;
create or replace function public.get_cloud_general_monitor_email_runtime_config() returns table(enabled boolean,api_key text,from_email text,from_name text) language plpgsql security definer set search_path=public,vault as $$begin if auth.role()<>'service_role' then raise exception 'cloud_general_monitor_email_service_required';end if;return query select settings.enabled,secrets.decrypted_secret,settings.from_email,settings.from_name from public.cloud_general_monitor_email_settings settings left join vault.decrypted_secrets secrets on secrets.id=settings.secret_id where settings.singleton=true;end $$;
create or replace function public.set_cloud_general_monitor_email_template(p_actor_profile_id uuid,p_subject_template text,p_body_template text) returns void language plpgsql security definer set search_path=public as $$declare v_subject text:=btrim(coalesce(p_subject_template,''));v_body text:=btrim(coalesce(p_body_template,''));v_unknown_tokens text;v_from_email text;begin if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_email_admin_required';end if;v_unknown_tokens:=regexp_replace(v_subject||E'\n'||v_body,'\{\{(recipient_name|welcome_url|expires_on|ai_request_limit)\}\}','','g');if char_length(v_subject) not between 1 and 120 or v_subject~E'[\r\n]' or char_length(v_body) not between 20 and 5000 or position('{{welcome_url}}' in v_body)=0 or v_unknown_tokens~'\{\{[a-z_]+\}\}' then raise exception 'cloud_general_monitor_email_template_invalid';end if;update public.cloud_general_monitor_email_settings set subject_template=v_subject,body_template=v_body,updated_by_profile_id=p_actor_profile_id,updated_at=now() where singleton=true returning from_email into v_from_email;insert into public.cloud_general_monitor_email_audit_logs(actor_profile_id,action,from_email) values(p_actor_profile_id,'update_template',coalesce(v_from_email,''));end $$;
revoke all on function public.set_cloud_general_monitor_email_provider(uuid,text,text,text,boolean) from public,anon,authenticated;revoke all on function public.get_cloud_general_monitor_email_runtime_config() from public,anon,authenticated;revoke all on function public.set_cloud_general_monitor_email_template(uuid,text,text) from public,anon,authenticated;grant execute on function public.set_cloud_general_monitor_email_provider(uuid,text,text,text,boolean) to service_role;grant execute on function public.get_cloud_general_monitor_email_runtime_config() to service_role;grant execute on function public.set_cloud_general_monitor_email_template(uuid,text,text) to service_role;

-- General Cloud image Provider settings (Black Forest Labs FLUX only).
do $$ begin if to_regprocedure('vault.create_secret(text,text,text)') is null then execute 'create extension if not exists supabase_vault with schema vault';end if;end $$;
create table if not exists public.cloud_general_image_provider_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false,model text not null default 'flux-2-pro' check(model in('flux-2-klein-9b','flux-2-pro','flux-2-max')),secret_id uuid,updated_by_profile_id uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now());
insert into public.cloud_general_image_provider_settings(singleton) values(true) on conflict(singleton) do nothing;
create table if not exists public.cloud_general_image_provider_audit_logs(id uuid primary key default gen_random_uuid(),actor_profile_id uuid not null references public.profiles(id) on delete restrict,action text not null check(action in('configure','replace_key','enable','disable')),model text not null check(model in('flux-2-klein-9b','flux-2-pro','flux-2-max')),enabled boolean not null,created_at timestamptz not null default now());
create index if not exists cloud_general_image_provider_audit_created_idx on public.cloud_general_image_provider_audit_logs(created_at desc);
alter table public.cloud_general_image_provider_settings enable row level security;alter table public.cloud_general_image_provider_audit_logs enable row level security;
grant select on public.cloud_general_image_provider_settings,public.cloud_general_image_provider_audit_logs to authenticated;grant select,insert,update,delete on public.cloud_general_image_provider_settings to service_role;grant select,insert on public.cloud_general_image_provider_audit_logs to service_role;
drop policy if exists "cloud_general_image_provider_settings_admin_read" on public.cloud_general_image_provider_settings;create policy "cloud_general_image_provider_settings_admin_read" on public.cloud_general_image_provider_settings for select using(public.is_admin());
drop policy if exists "cloud_general_image_provider_audit_admin_read" on public.cloud_general_image_provider_audit_logs;create policy "cloud_general_image_provider_audit_admin_read" on public.cloud_general_image_provider_audit_logs for select using(public.is_admin());
create or replace function public.set_cloud_general_image_provider(p_actor_profile_id uuid,p_api_key text,p_model text,p_enabled boolean) returns void language plpgsql security definer set search_path=public,vault as $$declare v_settings public.cloud_general_image_provider_settings%rowtype;v_secret_id uuid;v_action text;v_api_key text:=nullif(btrim(coalesce(p_api_key,'')),'');begin if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_image_provider_admin_required';end if;if p_model not in('flux-2-klein-9b','flux-2-pro','flux-2-max') then raise exception 'cloud_general_image_provider_model_invalid';end if;if v_api_key is not null and(char_length(v_api_key)<20 or char_length(v_api_key)>500 or v_api_key~'[[:space:]]') then raise exception 'cloud_general_image_provider_key_invalid';end if;select * into v_settings from public.cloud_general_image_provider_settings where singleton=true for update;v_secret_id:=v_settings.secret_id;if v_api_key is not null then if v_secret_id is null then v_secret_id:=vault.create_secret(v_api_key,'mangai_cloud_general_bfl','MANGAI Cloud general image Black Forest Labs API key');v_action:='configure';else perform vault.update_secret(v_secret_id,v_api_key,'mangai_cloud_general_bfl','MANGAI Cloud general image Black Forest Labs API key');v_action:='replace_key';end if;elsif p_enabled and v_secret_id is null then raise exception 'cloud_general_image_provider_key_required';else v_action:=case when p_enabled then 'enable' else 'disable' end;end if;update public.cloud_general_image_provider_settings set enabled=p_enabled,model=p_model,secret_id=v_secret_id,updated_by_profile_id=p_actor_profile_id,updated_at=now() where singleton=true;insert into public.cloud_general_image_provider_audit_logs(actor_profile_id,action,model,enabled) values(p_actor_profile_id,v_action,p_model,p_enabled);end $$;
create or replace function public.get_cloud_general_image_runtime_config() returns table(enabled boolean,model text,api_key text) language plpgsql security definer set search_path=public,vault as $$begin if auth.role()<>'service_role' then raise exception 'cloud_general_image_provider_service_role_required';end if;return query select settings.enabled,settings.model,secrets.decrypted_secret from public.cloud_general_image_provider_settings settings left join vault.decrypted_secrets secrets on secrets.id=settings.secret_id where settings.singleton=true;end $$;
revoke all on function public.set_cloud_general_image_provider(uuid,text,text,boolean) from public,anon,authenticated;revoke all on function public.get_cloud_general_image_runtime_config() from public,anon,authenticated;grant execute on function public.set_cloud_general_image_provider(uuid,text,text,boolean) to service_role;grant execute on function public.get_cloud_general_image_runtime_config() to service_role;
insert into public.cloud_ai_provider_prices(provider_id,model_id,kind,job_type,pricing_version,credits,max_cost_micros,currency,active) select 'black-forest-labs',model_id,'image',job_type,'bfl-flux2-2026-03',credits,max_cost_micros,'USD',true from(values('flux-2-klein-9b',1,15000),('flux-2-pro',2,30000),('flux-2-max',4,70000)) models(model_id,credits,max_cost_micros) cross join(values('background'),('prop'),('effect'),('character_base')) jobs(job_type) on conflict(provider_id,model_id,job_type,pricing_version) do update set credits=excluded.credits,max_cost_micros=excluded.max_cost_micros,currency=excluded.currency,active=excluded.active,updated_at=now();
insert into public.cloud_ai_provider_prices(provider_id,model_id,kind,job_type,pricing_version,credits,max_cost_micros,currency,active) values('black-forest-labs','flux-pro-1.0-fill','image','background','bfl-flux1-fill-2026-08',3,50000,'USD',true) on conflict(provider_id,model_id,job_type,pricing_version) do update set credits=excluded.credits,max_cost_micros=excluded.max_cost_micros,currency=excluded.currency,active=excluded.active,updated_at=now();

-- Versioned character profiles for long-form manga consistency.
create table if not exists public.cloud_character_profiles(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,name text not null check(char_length(name) between 1 and 100),role text not null check(role in('protagonist','supporting','antagonist','other')),current_version integer not null default 1 check(current_version>=1),deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,project_id));
create index if not exists cloud_character_profiles_project_idx on public.cloud_character_profiles(project_id,updated_at desc) where deleted_at is null;
create table if not exists public.cloud_character_profile_versions(id uuid primary key default gen_random_uuid(),profile_id uuid not null,project_id uuid not null,owner_profile_id uuid not null references public.profiles(id) on delete cascade,version_number integer not null check(version_number>=1),appearance_age text not null default '' check(char_length(appearance_age)<=120),body_build text not null default '' check(char_length(body_build)<=300),hair text not null default '' check(char_length(hair)<=300),costume text not null default '' check(char_length(costume)<=500),color_palette text not null default '' check(char_length(color_palette)<=300),immutable_traits text[] not null default '{}' check(cardinality(immutable_traits)<=12),prompt text not null default '' check(char_length(prompt)<=3000),negative_prompt text not null default '' check(char_length(negative_prompt)<=1500),created_at timestamptz not null default now(),unique(profile_id,version_number),foreign key(profile_id,project_id) references public.cloud_character_profiles(id,project_id) on delete cascade);
create index if not exists cloud_character_profile_versions_profile_idx on public.cloud_character_profile_versions(profile_id,version_number desc);
alter table public.cloud_character_profiles enable row level security;alter table public.cloud_character_profile_versions enable row level security;
grant select on public.cloud_character_profiles,public.cloud_character_profile_versions to authenticated;grant select,insert,update,delete on public.cloud_character_profiles,public.cloud_character_profile_versions to service_role;
drop policy if exists "cloud_character_profiles_owner_read" on public.cloud_character_profiles;create policy "cloud_character_profiles_owner_read" on public.cloud_character_profiles for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_character_profile_versions_owner_read" on public.cloud_character_profile_versions;create policy "cloud_character_profile_versions_owner_read" on public.cloud_character_profile_versions for select using(owner_profile_id=public.current_profile_id());
create or replace function public.save_cloud_character_profile(p_project_id uuid,p_profile_id uuid,p_name text,p_role text,p_appearance_age text,p_body_build text,p_hair text,p_costume text,p_color_palette text,p_immutable_traits text[],p_prompt text,p_negative_prompt text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid:=coalesce(p_profile_id,gen_random_uuid());v_version integer;v_traits text[]:=coalesce(p_immutable_traits,'{}');begin if v_owner is null or not exists(select 1 from public.cloud_projects where id=p_project_id and owner_profile_id=v_owner and content_class='general' and deleted_at is null) then raise exception 'cloud_character_project_not_found';end if;if char_length(trim(coalesce(p_name,''))) not between 1 and 100 or p_role not in('protagonist','supporting','antagonist','other') or char_length(coalesce(p_appearance_age,''))>120 or char_length(coalesce(p_body_build,''))>300 or char_length(coalesce(p_hair,''))>300 or char_length(coalesce(p_costume,''))>500 or char_length(coalesce(p_color_palette,''))>300 or cardinality(v_traits)>12 or exists(select 1 from unnest(v_traits) value where char_length(trim(value)) not between 1 and 120) or char_length(coalesce(p_prompt,''))>3000 or char_length(coalesce(p_negative_prompt,''))>1500 then raise exception 'cloud_character_input_invalid';end if;select current_version+1 into v_version from public.cloud_character_profiles where id=v_id and project_id=p_project_id and owner_profile_id=v_owner for update;if found then update public.cloud_character_profiles set name=trim(p_name),role=p_role,current_version=v_version,deleted_at=null,updated_at=now() where id=v_id;else v_version:=1;insert into public.cloud_character_profiles(id,project_id,owner_profile_id,name,role,current_version) values(v_id,p_project_id,v_owner,trim(p_name),p_role,v_version);end if;insert into public.cloud_character_profile_versions(profile_id,project_id,owner_profile_id,version_number,appearance_age,body_build,hair,costume,color_palette,immutable_traits,prompt,negative_prompt) values(v_id,p_project_id,v_owner,v_version,trim(coalesce(p_appearance_age,'')),trim(coalesce(p_body_build,'')),trim(coalesce(p_hair,'')),trim(coalesce(p_costume,'')),trim(coalesce(p_color_palette,'')),v_traits,trim(coalesce(p_prompt,'')),trim(coalesce(p_negative_prompt,'')));return v_id;end $$;
create or replace function public.delete_cloud_character_profile(p_project_id uuid,p_profile_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin update public.cloud_character_profiles set deleted_at=now(),updated_at=now() where id=p_profile_id and project_id=p_project_id and owner_profile_id=public.current_profile_id() and deleted_at is null;if not found then raise exception 'cloud_character_profile_not_found';end if;end $$;
revoke all on function public.save_cloud_character_profile(uuid,uuid,text,text,text,text,text,text,text,text[],text,text) from public,anon;revoke all on function public.delete_cloud_character_profile(uuid,uuid) from public,anon;grant execute on function public.save_cloud_character_profile(uuid,uuid,text,text,text,text,text,text,text,text[],text,text) to authenticated,service_role;grant execute on function public.delete_cloud_character_profile(uuid,uuid) to authenticated,service_role;

-- Phase M2-2: versioned style bible and location/prop profiles.
create table if not exists public.cloud_style_bibles(id uuid primary key default gen_random_uuid(),project_id uuid not null unique references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,current_version integer not null default 1 check(current_version>=1),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,project_id));
create table if not exists public.cloud_style_bible_versions(id uuid primary key default gen_random_uuid(),bible_id uuid not null,project_id uuid not null,owner_profile_id uuid not null references public.profiles(id) on delete cascade,version_number integer not null check(version_number>=1),art_style text not null default '' check(char_length(art_style)<=500),linework text not null default '' check(char_length(linework)<=500),shading text not null default '' check(char_length(shading)<=500),background_detail text not null default '' check(char_length(background_detail)<=500),composition_rules text not null default '' check(char_length(composition_rules)<=1000),negative_prompt text not null default '' check(char_length(negative_prompt)<=1500),created_at timestamptz not null default now(),unique(bible_id,version_number),foreign key(bible_id,project_id) references public.cloud_style_bibles(id,project_id) on delete cascade);
create index if not exists cloud_style_bible_versions_bible_idx on public.cloud_style_bible_versions(bible_id,version_number desc);
create table if not exists public.cloud_world_profiles(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in('location','prop')),name text not null check(char_length(name) between 1 and 100),current_version integer not null default 1 check(current_version>=1),deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,project_id));
create index if not exists cloud_world_profiles_project_idx on public.cloud_world_profiles(project_id,kind,updated_at desc) where deleted_at is null;
create table if not exists public.cloud_world_profile_versions(id uuid primary key default gen_random_uuid(),profile_id uuid not null,project_id uuid not null,owner_profile_id uuid not null references public.profiles(id) on delete cascade,version_number integer not null check(version_number>=1),description text not null default '' check(char_length(description)<=1000),visual_traits text[] not null default '{}' check(cardinality(visual_traits)<=12),color_palette text not null default '' check(char_length(color_palette)<=300),continuity_rules text[] not null default '{}' check(cardinality(continuity_rules)<=12),prompt text not null default '' check(char_length(prompt)<=3000),negative_prompt text not null default '' check(char_length(negative_prompt)<=1500),created_at timestamptz not null default now(),unique(profile_id,version_number),foreign key(profile_id,project_id) references public.cloud_world_profiles(id,project_id) on delete cascade);
create index if not exists cloud_world_profile_versions_profile_idx on public.cloud_world_profile_versions(profile_id,version_number desc);
alter table public.cloud_style_bibles enable row level security;alter table public.cloud_style_bible_versions enable row level security;alter table public.cloud_world_profiles enable row level security;alter table public.cloud_world_profile_versions enable row level security;
grant select on public.cloud_style_bibles,public.cloud_style_bible_versions,public.cloud_world_profiles,public.cloud_world_profile_versions to authenticated;grant select,insert,update,delete on public.cloud_style_bibles,public.cloud_style_bible_versions,public.cloud_world_profiles,public.cloud_world_profile_versions to service_role;
drop policy if exists "cloud_style_bibles_owner_read" on public.cloud_style_bibles;create policy "cloud_style_bibles_owner_read" on public.cloud_style_bibles for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_style_bible_versions_owner_read" on public.cloud_style_bible_versions;create policy "cloud_style_bible_versions_owner_read" on public.cloud_style_bible_versions for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_world_profiles_owner_read" on public.cloud_world_profiles;create policy "cloud_world_profiles_owner_read" on public.cloud_world_profiles for select using(owner_profile_id=public.current_profile_id());drop policy if exists "cloud_world_profile_versions_owner_read" on public.cloud_world_profile_versions;create policy "cloud_world_profile_versions_owner_read" on public.cloud_world_profile_versions for select using(owner_profile_id=public.current_profile_id());
create or replace function public.save_cloud_style_bible(p_project_id uuid,p_art_style text,p_linework text,p_shading text,p_background_detail text,p_composition_rules text,p_negative_prompt text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid;v_version integer;begin if v_owner is null or not exists(select 1 from public.cloud_projects where id=p_project_id and owner_profile_id=v_owner and content_class='general' and deleted_at is null) then raise exception 'cloud_style_project_not_found';end if;if char_length(coalesce(p_art_style,''))>500 or char_length(coalesce(p_linework,''))>500 or char_length(coalesce(p_shading,''))>500 or char_length(coalesce(p_background_detail,''))>500 or char_length(coalesce(p_composition_rules,''))>1000 or char_length(coalesce(p_negative_prompt,''))>1500 then raise exception 'cloud_style_input_invalid';end if;select id,current_version+1 into v_id,v_version from public.cloud_style_bibles where project_id=p_project_id and owner_profile_id=v_owner for update;if found then update public.cloud_style_bibles set current_version=v_version,updated_at=now() where id=v_id;else v_id:=gen_random_uuid();v_version:=1;insert into public.cloud_style_bibles(id,project_id,owner_profile_id,current_version) values(v_id,p_project_id,v_owner,v_version);end if;insert into public.cloud_style_bible_versions(bible_id,project_id,owner_profile_id,version_number,art_style,linework,shading,background_detail,composition_rules,negative_prompt) values(v_id,p_project_id,v_owner,v_version,trim(coalesce(p_art_style,'')),trim(coalesce(p_linework,'')),trim(coalesce(p_shading,'')),trim(coalesce(p_background_detail,'')),trim(coalesce(p_composition_rules,'')),trim(coalesce(p_negative_prompt,'')));return v_id;end $$;
create or replace function public.save_cloud_world_profile(p_project_id uuid,p_profile_id uuid,p_kind text,p_name text,p_description text,p_visual_traits text[],p_color_palette text,p_continuity_rules text[],p_prompt text,p_negative_prompt text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid:=coalesce(p_profile_id,gen_random_uuid());v_version integer;v_traits text[]:=coalesce(p_visual_traits,'{}');v_rules text[]:=coalesce(p_continuity_rules,'{}');begin if v_owner is null or not exists(select 1 from public.cloud_projects where id=p_project_id and owner_profile_id=v_owner and content_class='general' and deleted_at is null) then raise exception 'cloud_world_project_not_found';end if;if p_kind not in('location','prop') or char_length(trim(coalesce(p_name,''))) not between 1 and 100 or char_length(coalesce(p_description,''))>1000 or cardinality(v_traits)>12 or cardinality(v_rules)>12 or exists(select 1 from unnest(v_traits||v_rules) value where char_length(trim(value)) not between 1 and 120) or char_length(coalesce(p_color_palette,''))>300 or char_length(coalesce(p_prompt,''))>3000 or char_length(coalesce(p_negative_prompt,''))>1500 then raise exception 'cloud_world_input_invalid';end if;select current_version+1 into v_version from public.cloud_world_profiles where id=v_id and project_id=p_project_id and owner_profile_id=v_owner for update;if found then update public.cloud_world_profiles set kind=p_kind,name=trim(p_name),current_version=v_version,deleted_at=null,updated_at=now() where id=v_id;else v_version:=1;insert into public.cloud_world_profiles(id,project_id,owner_profile_id,kind,name,current_version) values(v_id,p_project_id,v_owner,p_kind,trim(p_name),v_version);end if;insert into public.cloud_world_profile_versions(profile_id,project_id,owner_profile_id,version_number,description,visual_traits,color_palette,continuity_rules,prompt,negative_prompt) values(v_id,p_project_id,v_owner,v_version,trim(coalesce(p_description,'')),v_traits,trim(coalesce(p_color_palette,'')),v_rules,trim(coalesce(p_prompt,'')),trim(coalesce(p_negative_prompt,'')));return v_id;end $$;
create or replace function public.delete_cloud_world_profile(p_project_id uuid,p_profile_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin update public.cloud_world_profiles set deleted_at=now(),updated_at=now() where id=p_profile_id and project_id=p_project_id and owner_profile_id=public.current_profile_id() and deleted_at is null;if not found then raise exception 'cloud_world_profile_not_found';end if;end $$;
revoke all on function public.save_cloud_style_bible(uuid,text,text,text,text,text,text) from public,anon;revoke all on function public.save_cloud_world_profile(uuid,uuid,text,text,text,text[],text,text[],text,text) from public,anon;revoke all on function public.delete_cloud_world_profile(uuid,uuid) from public,anon;grant execute on function public.save_cloud_style_bible(uuid,text,text,text,text,text,text) to authenticated,service_role;grant execute on function public.save_cloud_world_profile(uuid,uuid,text,text,text,text[],text,text[],text,text) to authenticated,service_role;grant execute on function public.delete_cloud_world_profile(uuid,uuid) to authenticated,service_role;

-- Phase M2-3: visual references and explicit panel subject assignments.
create table if not exists public.cloud_visual_reference_assets(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,subject_kind text not null check(subject_kind in('character','style','location','prop')),subject_id uuid not null,asset_id uuid not null references public.cloud_assets(id) on delete cascade,label text not null default '' check(char_length(label)<=120),created_at timestamptz not null default now(),unique(project_id,subject_kind,subject_id,asset_id));
create index if not exists cloud_visual_reference_subject_idx on public.cloud_visual_reference_assets(project_id,subject_kind,subject_id,created_at);
create table if not exists public.cloud_panel_subject_assignments(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,page_id uuid not null references public.cloud_pages(id) on delete cascade,panel_id uuid not null,subject_kind text not null check(subject_kind in('character','location','prop')),subject_id uuid not null,created_at timestamptz not null default now(),unique(project_id,page_id,panel_id,subject_kind,subject_id));
create index if not exists cloud_panel_subject_assignment_panel_idx on public.cloud_panel_subject_assignments(project_id,page_id,panel_id);
alter table public.cloud_visual_reference_assets enable row level security;alter table public.cloud_panel_subject_assignments enable row level security;
grant select on public.cloud_visual_reference_assets,public.cloud_panel_subject_assignments to authenticated;grant select,insert,update,delete on public.cloud_visual_reference_assets,public.cloud_panel_subject_assignments to service_role;
drop policy if exists "cloud_visual_reference_owner_read" on public.cloud_visual_reference_assets;create policy "cloud_visual_reference_owner_read" on public.cloud_visual_reference_assets for select using(owner_profile_id=public.current_profile_id());
drop policy if exists "cloud_panel_subject_assignment_owner_read" on public.cloud_panel_subject_assignments;create policy "cloud_panel_subject_assignment_owner_read" on public.cloud_panel_subject_assignments for select using(owner_profile_id=public.current_profile_id());
create or replace function public.cloud_visual_subject_exists(p_project_id uuid,p_subject_kind text,p_subject_id uuid,p_owner_profile_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select case p_subject_kind when 'character' then exists(select 1 from public.cloud_character_profiles where id=p_subject_id and project_id=p_project_id and owner_profile_id=p_owner_profile_id and deleted_at is null) when 'style' then exists(select 1 from public.cloud_style_bibles where id=p_subject_id and project_id=p_project_id and owner_profile_id=p_owner_profile_id) when 'location' then exists(select 1 from public.cloud_world_profiles where id=p_subject_id and project_id=p_project_id and owner_profile_id=p_owner_profile_id and kind='location' and deleted_at is null) when 'prop' then exists(select 1 from public.cloud_world_profiles where id=p_subject_id and project_id=p_project_id and owner_profile_id=p_owner_profile_id and kind='prop' and deleted_at is null) else false end$$;
create or replace function public.save_cloud_visual_reference(p_project_id uuid,p_subject_kind text,p_subject_id uuid,p_asset_id uuid,p_label text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid;begin if v_owner is null or p_subject_kind not in('character','style','location','prop') or char_length(coalesce(p_label,''))>120 or not public.cloud_visual_subject_exists(p_project_id,p_subject_kind,p_subject_id,v_owner) or not exists(select 1 from public.cloud_assets where id=p_asset_id and project_id=p_project_id and owner_profile_id=v_owner and deleted_at is null) then raise exception 'cloud_visual_reference_invalid';end if;insert into public.cloud_visual_reference_assets(project_id,owner_profile_id,subject_kind,subject_id,asset_id,label) values(p_project_id,v_owner,p_subject_kind,p_subject_id,p_asset_id,trim(coalesce(p_label,''))) on conflict(project_id,subject_kind,subject_id,asset_id) do update set label=excluded.label returning id into v_id;return v_id;end$$;
create or replace function public.delete_cloud_visual_reference(p_project_id uuid,p_reference_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin delete from public.cloud_visual_reference_assets where id=p_reference_id and project_id=p_project_id and owner_profile_id=public.current_profile_id();if not found then raise exception 'cloud_visual_reference_not_found';end if;end$$;
create or replace function public.save_cloud_panel_subject_assignment(p_project_id uuid,p_page_id uuid,p_panel_id uuid,p_subject_kind text,p_subject_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid;begin if v_owner is null or p_subject_kind not in('character','location','prop') or not public.cloud_visual_subject_exists(p_project_id,p_subject_kind,p_subject_id,v_owner) or not exists(select 1 from public.cloud_pages page join public.cloud_projects project on project.id=page.project_id where page.id=p_page_id and page.project_id=p_project_id and page.deleted_at is null and project.owner_profile_id=v_owner and project.content_class='general' and project.deleted_at is null) then raise exception 'cloud_panel_subject_assignment_invalid';end if;insert into public.cloud_panel_subject_assignments(project_id,owner_profile_id,page_id,panel_id,subject_kind,subject_id) values(p_project_id,v_owner,p_page_id,p_panel_id,p_subject_kind,p_subject_id) on conflict(project_id,page_id,panel_id,subject_kind,subject_id) do update set owner_profile_id=excluded.owner_profile_id returning id into v_id;return v_id;end$$;
create or replace function public.delete_cloud_panel_subject_assignment(p_project_id uuid,p_assignment_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin delete from public.cloud_panel_subject_assignments where id=p_assignment_id and project_id=p_project_id and owner_profile_id=public.current_profile_id();if not found then raise exception 'cloud_panel_subject_assignment_not_found';end if;end$$;
revoke all on function public.cloud_visual_subject_exists(uuid,text,uuid,uuid) from public,anon,authenticated;revoke all on function public.save_cloud_visual_reference(uuid,text,uuid,uuid,text) from public,anon;revoke all on function public.delete_cloud_visual_reference(uuid,uuid) from public,anon;revoke all on function public.save_cloud_panel_subject_assignment(uuid,uuid,uuid,text,uuid) from public,anon;revoke all on function public.delete_cloud_panel_subject_assignment(uuid,uuid) from public,anon;
grant execute on function public.save_cloud_visual_reference(uuid,text,uuid,uuid,text) to authenticated,service_role;grant execute on function public.delete_cloud_visual_reference(uuid,uuid) to authenticated,service_role;grant execute on function public.save_cloud_panel_subject_assignment(uuid,uuid,uuid,text,uuid) to authenticated,service_role;grant execute on function public.delete_cloud_panel_subject_assignment(uuid,uuid) to authenticated,service_role;

-- Phase M4: chapter / scene hierarchy and bounded 32-page management.
create table if not exists public.cloud_chapters(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,title text not null check(char_length(title) between 1 and 200),order_index integer not null check(order_index>=0),revision bigint not null default 0 check(revision>=0),deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(project_id,order_index),unique(id,project_id));
alter table public.cloud_episodes add column if not exists chapter_id uuid references public.cloud_chapters(id) on delete set null;
create table if not exists public.cloud_scenes(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,chapter_id uuid not null references public.cloud_chapters(id) on delete cascade,episode_id uuid not null references public.cloud_episodes(id) on delete cascade,title text not null check(char_length(title) between 1 and 200),summary text not null default '' check(char_length(summary)<=2000),order_index integer not null check(order_index>=0),revision bigint not null default 0 check(revision>=0),deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(episode_id,order_index),unique(id,episode_id));
alter table public.cloud_pages add column if not exists scene_id uuid references public.cloud_scenes(id) on delete set null;
create index if not exists cloud_chapters_project_idx on public.cloud_chapters(project_id,order_index) where deleted_at is null;create index if not exists cloud_episodes_chapter_idx on public.cloud_episodes(chapter_id,order_index) where deleted_at is null;create index if not exists cloud_scenes_episode_idx on public.cloud_scenes(episode_id,order_index) where deleted_at is null;create index if not exists cloud_pages_scene_idx on public.cloud_pages(scene_id,order_index) where deleted_at is null;
alter table public.cloud_chapters enable row level security;alter table public.cloud_scenes enable row level security;grant select on public.cloud_chapters,public.cloud_scenes to anon,authenticated;grant insert,update,delete on public.cloud_chapters,public.cloud_scenes to authenticated;
drop policy if exists "cloud_chapters_read" on public.cloud_chapters;create policy "cloud_chapters_read" on public.cloud_chapters for select using(public.cloud_project_can_read(project_id));drop policy if exists "cloud_chapters_write" on public.cloud_chapters;create policy "cloud_chapters_write" on public.cloud_chapters for all using(public.cloud_project_can_edit(project_id)) with check(public.cloud_project_can_edit(project_id));drop policy if exists "cloud_scenes_read" on public.cloud_scenes;create policy "cloud_scenes_read" on public.cloud_scenes for select using(public.cloud_project_can_read(project_id));drop policy if exists "cloud_scenes_write" on public.cloud_scenes;create policy "cloud_scenes_write" on public.cloud_scenes for all using(public.cloud_project_can_edit(project_id)) with check(public.cloud_project_can_edit(project_id));
create or replace function public.create_cloud_project_with_first_page(p_title text,p_description text default '',p_age_rating text default '全年齢',p_reading_direction text default 'rtl',p_width integer default 1600,p_height integer default 2400,p_dpi integer default 300) returns table(project_id uuid,episode_id uuid,page_id uuid) language plpgsql security invoker set search_path=public as $$declare v_profile_id uuid:=public.current_profile_id();v_chapter_id uuid:=gen_random_uuid();v_scene_id uuid:=gen_random_uuid();begin if v_profile_id is null then raise exception 'profile_required';end if;project_id:=gen_random_uuid();episode_id:=gen_random_uuid();page_id:=gen_random_uuid();insert into public.cloud_projects(id,owner_profile_id,source_surface,content_class,title,description,age_rating,reading_direction,width,height,dpi) values(project_id,v_profile_id,'cloud','general',trim(p_title),coalesce(p_description,''),p_age_rating,p_reading_direction,p_width,p_height,p_dpi);insert into public.cloud_chapters(id,project_id,title,order_index) values(v_chapter_id,project_id,'第1章',0);insert into public.cloud_episodes(id,project_id,chapter_id,title,order_index) values(episode_id,project_id,v_chapter_id,'第1話',0);insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,order_index) values(v_scene_id,project_id,v_chapter_id,episode_id,'シーン1',0);insert into public.cloud_pages(id,project_id,episode_id,scene_id,page_number,order_index,width,height) values(page_id,project_id,episode_id,v_scene_id,1,0,p_width,p_height);insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id) values(project_id,page_id,0,jsonb_build_object('schemaVersion',1,'pageId',page_id,'width',p_width,'height',p_height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile_id);insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(project_id,0,jsonb_build_object('event','project_created','chapterId',v_chapter_id,'episodeId',episode_id,'sceneId',v_scene_id,'pageId',page_id),v_profile_id);return next;end$$;
create or replace function public.add_cloud_chapter(p_project_id uuid,p_title text) returns uuid language plpgsql security invoker set search_path=public as $$declare v_id uuid:=gen_random_uuid();v_order integer;v_revision bigint;v_profile uuid:=public.current_profile_id();begin if not public.cloud_project_can_edit(p_project_id) or char_length(trim(coalesce(p_title,''))) not between 1 and 200 then raise exception 'cloud_chapter_not_editable';end if;perform 1 from public.cloud_projects where id=p_project_id for update;select coalesce(max(order_index),-1)+1 into v_order from public.cloud_chapters where project_id=p_project_id and deleted_at is null;insert into public.cloud_chapters(id,project_id,title,order_index) values(v_id,p_project_id,trim(p_title),v_order);update public.cloud_projects set revision=revision+1,updated_at=now() where id=p_project_id returning revision into v_revision;insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(p_project_id,v_revision,jsonb_build_object('event','chapter_added','chapterId',v_id),v_profile);return v_id;end$$;
create or replace function public.add_cloud_episode_to_chapter(p_chapter_id uuid,p_title text) returns uuid language plpgsql security invoker set search_path=public as $$declare v_chapter public.cloud_chapters%rowtype;v_episode uuid:=gen_random_uuid();v_scene uuid:=gen_random_uuid();v_order integer;v_revision bigint;v_profile uuid:=public.current_profile_id();begin select * into v_chapter from public.cloud_chapters where id=p_chapter_id and deleted_at is null;if not found or not public.cloud_project_can_edit(v_chapter.project_id) or char_length(trim(coalesce(p_title,''))) not between 1 and 200 then raise exception 'cloud_chapter_not_editable';end if;perform 1 from public.cloud_projects where id=v_chapter.project_id for update;select coalesce(max(order_index),-1)+1 into v_order from public.cloud_episodes where project_id=v_chapter.project_id and deleted_at is null;insert into public.cloud_episodes(id,project_id,chapter_id,title,order_index) values(v_episode,v_chapter.project_id,v_chapter.id,trim(p_title),v_order);insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,order_index) values(v_scene,v_chapter.project_id,v_chapter.id,v_episode,'シーン1',0);update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_chapter.project_id returning revision into v_revision;insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_chapter.project_id,v_revision,jsonb_build_object('event','episode_added','chapterId',v_chapter.id,'episodeId',v_episode,'sceneId',v_scene),v_profile);return v_episode;end$$;
create or replace function public.add_cloud_scene(p_episode_id uuid,p_title text,p_summary text default '') returns uuid language plpgsql security invoker set search_path=public as $$declare v_episode public.cloud_episodes%rowtype;v_id uuid:=gen_random_uuid();v_order integer;v_revision bigint;v_profile uuid:=public.current_profile_id();begin select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null;if not found or v_episode.chapter_id is null or not public.cloud_project_can_edit(v_episode.project_id) or char_length(trim(coalesce(p_title,''))) not between 1 and 200 or char_length(coalesce(p_summary,''))>2000 then raise exception 'cloud_scene_not_editable';end if;perform 1 from public.cloud_projects where id=v_episode.project_id for update;select coalesce(max(order_index),-1)+1 into v_order from public.cloud_scenes where episode_id=p_episode_id and deleted_at is null;insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,summary,order_index) values(v_id,v_episode.project_id,v_episode.chapter_id,p_episode_id,trim(p_title),trim(coalesce(p_summary,'')),v_order);update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision;insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','scene_added','episodeId',p_episode_id,'sceneId',v_id),v_profile);return v_id;end$$;
create or replace function public.add_cloud_page_to_scene(p_scene_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$declare v_scene public.cloud_scenes%rowtype;v_project public.cloud_projects%rowtype;v_id uuid:=gen_random_uuid();v_order integer;v_number integer;v_revision bigint;v_profile uuid:=public.current_profile_id();begin select * into v_scene from public.cloud_scenes where id=p_scene_id and deleted_at is null;if not found or not public.cloud_project_can_edit(v_scene.project_id) then raise exception 'cloud_scene_not_editable';end if;select * into v_project from public.cloud_projects where id=v_scene.project_id for update;select max(page.order_index)+1 into v_order from public.cloud_pages page where page.scene_id=v_scene.id and page.deleted_at is null;if v_order is null then select min(page.order_index) into v_order from public.cloud_pages page join public.cloud_scenes later_scene on later_scene.id=page.scene_id where page.episode_id=v_scene.episode_id and page.deleted_at is null and later_scene.deleted_at is null and later_scene.order_index>v_scene.order_index;end if;if v_order is null then select coalesce(max(order_index),-1)+1 into v_order from public.cloud_pages where episode_id=v_scene.episode_id and deleted_at is null;end if;update public.cloud_pages set order_index=order_index+1000000 where episode_id=v_scene.episode_id and deleted_at is null and order_index>=v_order;update public.cloud_pages set order_index=order_index-999999 where episode_id=v_scene.episode_id and deleted_at is null and order_index>=1000000;select coalesce(max(page_number),0)+1 into v_number from public.cloud_pages where project_id=v_scene.project_id and deleted_at is null;insert into public.cloud_pages(id,project_id,episode_id,scene_id,page_number,order_index,width,height) values(v_id,v_scene.project_id,v_scene.episode_id,v_scene.id,v_number,v_order,v_project.width,v_project.height);insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id) values(v_scene.project_id,v_id,0,jsonb_build_object('schemaVersion',1,'pageId',v_id,'width',v_project.width,'height',v_project.height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile);with numbered as(select page.id,row_number() over(order by chapter.order_index,episode.order_index,page.order_index,page.id)::integer as n from public.cloud_pages page join public.cloud_episodes episode on episode.id=page.episode_id left join public.cloud_chapters chapter on chapter.id=episode.chapter_id where page.project_id=v_scene.project_id and page.deleted_at is null and episode.deleted_at is null) update public.cloud_pages page set page_number=numbered.n from numbered where page.id=numbered.id;update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_scene.project_id returning revision into v_revision;insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_scene.project_id,v_revision,jsonb_build_object('event','page_added','episodeId',v_scene.episode_id,'sceneId',v_scene.id,'pageId',v_id),v_profile);return v_id;end$$;
create or replace function public.move_cloud_page_before(p_page_id uuid,p_target_page_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$declare v_page public.cloud_pages%rowtype;v_target public.cloud_pages%rowtype;v_revision bigint;v_profile uuid:=public.current_profile_id();begin if p_page_id=p_target_page_id then return p_page_id;end if;select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null;select * into v_target from public.cloud_pages where id=p_target_page_id and deleted_at is null;if v_page.id is null or v_target.id is null or v_page.project_id<>v_target.project_id or v_page.episode_id<>v_target.episode_id or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'cloud_page_move_invalid';end if;perform 1 from public.cloud_projects where id=v_page.project_id for update;update public.cloud_pages set order_index=2147483647 where id=v_page.id;if v_page.order_index<v_target.order_index then update public.cloud_pages set order_index=order_index+1000000 where episode_id=v_page.episode_id and deleted_at is null and order_index>v_page.order_index and order_index<v_target.order_index;update public.cloud_pages set order_index=order_index-1000001 where episode_id=v_page.episode_id and deleted_at is null and order_index>=1000000 and order_index<2147483647;update public.cloud_pages set order_index=v_target.order_index-1,scene_id=v_target.scene_id where id=v_page.id;else update public.cloud_pages set order_index=order_index+1000000 where episode_id=v_page.episode_id and deleted_at is null and order_index>=v_target.order_index and order_index<v_page.order_index;update public.cloud_pages set order_index=order_index-999999 where episode_id=v_page.episode_id and deleted_at is null and order_index>=1000000 and order_index<2147483647;update public.cloud_pages set order_index=v_target.order_index,scene_id=v_target.scene_id where id=v_page.id;end if;with numbered as(select page.id,row_number() over(order by chapter.order_index,episode.order_index,page.order_index,page.id)::integer as n from public.cloud_pages page join public.cloud_episodes episode on episode.id=page.episode_id left join public.cloud_chapters chapter on chapter.id=episode.chapter_id where page.project_id=v_page.project_id and page.deleted_at is null and episode.deleted_at is null) update public.cloud_pages page set page_number=numbered.n from numbered where page.id=numbered.id;update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_revision;insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_revision,jsonb_build_object('event','page_reordered','pageId',v_page.id,'beforePageId',v_target.id,'sceneId',v_target.scene_id),v_profile);return v_page.id;end$$;
revoke all on function public.add_cloud_chapter(uuid,text) from public,anon;revoke all on function public.add_cloud_episode_to_chapter(uuid,text) from public,anon;revoke all on function public.add_cloud_scene(uuid,text,text) from public,anon;revoke all on function public.add_cloud_page_to_scene(uuid) from public,anon;revoke all on function public.move_cloud_page_before(uuid,uuid) from public,anon;grant execute on function public.add_cloud_chapter(uuid,text) to authenticated,service_role;grant execute on function public.add_cloud_episode_to_chapter(uuid,text) to authenticated,service_role;grant execute on function public.add_cloud_scene(uuid,text,text) to authenticated,service_role;grant execute on function public.add_cloud_page_to_scene(uuid) to authenticated,service_role;grant execute on function public.move_cloud_page_before(uuid,uuid) to authenticated,service_role;

-- Phase M4: bounded multi-page generation batches and expiring page edit locks.
create table if not exists public.cloud_generation_batches(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,created_by_profile_id uuid not null references public.profiles(id) on delete restrict,idempotency_key text not null check(char_length(idempotency_key) between 1 and 200),requested_page_ids uuid[] not null check(cardinality(requested_page_ids) between 4 and 8),status text not null default 'active' check(status in('active','paused','completed','canceled')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(created_by_profile_id,idempotency_key),unique(id,project_id));
create table if not exists public.cloud_generation_batch_jobs(batch_id uuid not null references public.cloud_generation_batches(id) on delete cascade,project_id uuid not null,page_id uuid not null,job_id uuid not null references public.cloud_generation_jobs(id) on delete restrict,created_at timestamptz not null default now(),primary key(batch_id,job_id),foreign key(batch_id,project_id) references public.cloud_generation_batches(id,project_id) on delete cascade,foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade);
create table if not exists public.cloud_page_edit_locks(page_id uuid primary key,project_id uuid not null,locked_by_profile_id uuid not null references public.profiles(id) on delete cascade,lock_token uuid not null,lease_expires_at timestamptz not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade);
create index if not exists cloud_generation_batches_project_idx on public.cloud_generation_batches(project_id,created_at desc);create index if not exists cloud_generation_batch_jobs_page_idx on public.cloud_generation_batch_jobs(page_id,created_at desc);create index if not exists cloud_page_edit_locks_project_idx on public.cloud_page_edit_locks(project_id,lease_expires_at);
alter table public.cloud_generation_batches enable row level security;alter table public.cloud_generation_batch_jobs enable row level security;alter table public.cloud_page_edit_locks enable row level security;grant select on public.cloud_generation_batches,public.cloud_generation_batch_jobs,public.cloud_page_edit_locks to authenticated;
drop policy if exists "cloud_generation_batches_owner_read" on public.cloud_generation_batches;create policy "cloud_generation_batches_owner_read" on public.cloud_generation_batches for select using(created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));drop policy if exists "cloud_generation_batch_jobs_owner_read" on public.cloud_generation_batch_jobs;create policy "cloud_generation_batch_jobs_owner_read" on public.cloud_generation_batch_jobs for select using(public.cloud_project_can_edit(project_id));drop policy if exists "cloud_page_edit_locks_editor_read" on public.cloud_page_edit_locks;create policy "cloud_page_edit_locks_editor_read" on public.cloud_page_edit_locks for select using(public.cloud_project_can_edit(project_id));
create or replace function public.create_cloud_generation_batch(p_project_id uuid,p_page_ids uuid[],p_idempotency_key text) returns uuid language plpgsql security definer set search_path=public as $$declare v_profile uuid:=public.current_profile_id();v_batch uuid;v_distinct integer;begin if v_profile is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_batch_not_editable';end if;select count(distinct page_id) into v_distinct from unnest(p_page_ids) page_id;if cardinality(p_page_ids) not between 4 and 8 or v_distinct<>cardinality(p_page_ids) or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 200 then raise exception 'cloud_batch_invalid';end if;if(select count(*) from public.cloud_pages where project_id=p_project_id and id=any(p_page_ids) and deleted_at is null)<>cardinality(p_page_ids) then raise exception 'cloud_batch_pages_invalid';end if;insert into public.cloud_generation_batches(project_id,created_by_profile_id,idempotency_key,requested_page_ids) values(p_project_id,v_profile,trim(p_idempotency_key),p_page_ids) on conflict(created_by_profile_id,idempotency_key) do update set updated_at=public.cloud_generation_batches.updated_at returning id into v_batch;return v_batch;end$$;
create or replace function public.attach_cloud_generation_batch_job(p_batch_id uuid,p_job_id uuid) returns uuid language plpgsql security definer set search_path=public as $$declare v_batch public.cloud_generation_batches%rowtype;v_job public.cloud_generation_jobs%rowtype;begin select * into v_batch from public.cloud_generation_batches where id=p_batch_id and created_by_profile_id=public.current_profile_id();select * into v_job from public.cloud_generation_jobs where id=p_job_id and created_by_profile_id=public.current_profile_id();if v_batch.id is null or v_job.id is null or v_job.project_id<>v_batch.project_id or v_job.page_id is null or not(v_job.page_id=any(v_batch.requested_page_ids)) then raise exception 'cloud_batch_job_invalid';end if;insert into public.cloud_generation_batch_jobs(batch_id,project_id,page_id,job_id) values(v_batch.id,v_batch.project_id,v_job.page_id,v_job.id) on conflict do nothing;return v_job.id;end$$;
create or replace function public.replace_cloud_generation_batch_job(p_failed_job_id uuid,p_new_job_id uuid) returns integer language plpgsql security definer set search_path=public as $$declare v_failed public.cloud_generation_jobs%rowtype;v_new public.cloud_generation_jobs%rowtype;v_count integer;begin select * into v_failed from public.cloud_generation_jobs where id=p_failed_job_id and created_by_profile_id=public.current_profile_id() and status='failed';select * into v_new from public.cloud_generation_jobs where id=p_new_job_id and created_by_profile_id=public.current_profile_id();if v_failed.id is null or v_new.id is null or v_new.status<>'queued' or v_failed.project_id<>v_new.project_id or v_failed.page_id is distinct from v_new.page_id then raise exception 'cloud_batch_retry_invalid';end if;insert into public.cloud_generation_batch_jobs(batch_id,project_id,page_id,job_id) select link.batch_id,link.project_id,link.page_id,v_new.id from public.cloud_generation_batch_jobs link join public.cloud_generation_batches batch on batch.id=link.batch_id where link.job_id=v_failed.id and batch.status in('active','paused') on conflict do nothing;get diagnostics v_count=row_count;if v_count>0 then delete from public.cloud_generation_batch_jobs where job_id=v_failed.id;end if;return v_count;end$$;
create or replace function public.set_cloud_generation_batch_state(p_batch_id uuid,p_status text) returns uuid language plpgsql security definer set search_path=public as $$declare v_batch public.cloud_generation_batches%rowtype;v_job record;begin select * into v_batch from public.cloud_generation_batches where id=p_batch_id and created_by_profile_id=public.current_profile_id() for update;if v_batch.id is null or p_status not in('active','paused','canceled') then raise exception 'cloud_batch_not_editable';end if;if p_status='canceled' then for v_job in select job_id from public.cloud_generation_batch_jobs where batch_id=v_batch.id loop begin perform public.cancel_cloud_generation_job(v_job.job_id);exception when others then null;end;end loop;end if;update public.cloud_generation_batches set status=p_status,updated_at=now() where id=v_batch.id;return v_batch.id;end$$;
create or replace function public.acquire_cloud_page_edit_lock(p_page_id uuid,p_lock_token uuid,p_lease_seconds integer default 120) returns timestamptz language plpgsql security definer set search_path=public as $$declare v_page public.cloud_pages%rowtype;v_profile uuid:=public.current_profile_id();v_expires timestamptz;begin select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null;if v_page.id is null or v_profile is null or not public.cloud_project_can_edit(v_page.project_id) or p_lease_seconds not between 60 and 300 then raise exception 'cloud_page_lock_invalid';end if;insert into public.cloud_page_edit_locks(page_id,project_id,locked_by_profile_id,lock_token,lease_expires_at) values(v_page.id,v_page.project_id,v_profile,p_lock_token,now()+make_interval(secs=>p_lease_seconds)) on conflict(page_id) do update set locked_by_profile_id=excluded.locked_by_profile_id,lock_token=excluded.lock_token,lease_expires_at=excluded.lease_expires_at,updated_at=now() where public.cloud_page_edit_locks.lease_expires_at<=now() or(public.cloud_page_edit_locks.locked_by_profile_id=v_profile and public.cloud_page_edit_locks.lock_token=p_lock_token) returning lease_expires_at into v_expires;if v_expires is null then raise exception 'cloud_page_locked';end if;return v_expires;end$$;
create or replace function public.release_cloud_page_edit_lock(p_page_id uuid,p_lock_token uuid) returns boolean language plpgsql security definer set search_path=public as $$begin delete from public.cloud_page_edit_locks where page_id=p_page_id and locked_by_profile_id=public.current_profile_id() and lock_token=p_lock_token;return found;end$$;
create or replace function public.claim_cloud_generation_job(p_worker_id text,p_lease_seconds integer default 120) returns setof public.cloud_generation_jobs language plpgsql security definer set search_path=public as $$declare v_job_id uuid;v_token uuid:=gen_random_uuid();begin if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 30 and 900 then raise exception 'cloud_worker_not_authorized';end if;select job.id into v_job_id from public.cloud_generation_jobs job where((job.status='queued' and(job.retry_at is null or job.retry_at<=now())) or(job.status='running' and job.lease_expires_at<=now())) and not exists(select 1 from public.cloud_generation_batch_jobs link join public.cloud_generation_batches batch on batch.id=link.batch_id where link.job_id=job.id and batch.status in('paused','canceled')) order by job.created_at for update of job skip locked limit 1;if v_job_id is null then return;end if;return query update public.cloud_generation_jobs set status='running',progress=1,attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),started_at=coalesce(started_at,now()),updated_at=now() where id=v_job_id returning *;end$$;
revoke all on function public.create_cloud_generation_batch(uuid,uuid[],text) from public,anon;revoke all on function public.attach_cloud_generation_batch_job(uuid,uuid) from public,anon;revoke all on function public.replace_cloud_generation_batch_job(uuid,uuid) from public,anon;revoke all on function public.set_cloud_generation_batch_state(uuid,text) from public,anon;revoke all on function public.acquire_cloud_page_edit_lock(uuid,uuid,integer) from public,anon;revoke all on function public.release_cloud_page_edit_lock(uuid,uuid) from public,anon;grant execute on function public.create_cloud_generation_batch(uuid,uuid[],text) to authenticated,service_role;grant execute on function public.attach_cloud_generation_batch_job(uuid,uuid) to authenticated,service_role;grant execute on function public.replace_cloud_generation_batch_job(uuid,uuid) to authenticated,service_role;grant execute on function public.set_cloud_generation_batch_state(uuid,text) to authenticated,service_role;grant execute on function public.acquire_cloud_page_edit_lock(uuid,uuid,integer) to authenticated,service_role;grant execute on function public.release_cloud_page_edit_lock(uuid,uuid) to authenticated,service_role;

-- Phase M4: durable production review and finalization.
alter table public.cloud_projects add column if not exists production_context_revision bigint not null default 0 check(production_context_revision>=0);
alter table public.cloud_pages add column if not exists production_status text not null default 'not_started';alter table public.cloud_pages add column if not exists production_status_updated_at timestamptz not null default now();alter table public.cloud_pages add column if not exists production_status_updated_by_profile_id uuid references public.profiles(id) on delete set null;alter table public.cloud_pages add column if not exists finalized_revision bigint check(finalized_revision>=0);alter table public.cloud_pages add column if not exists reviewed_context_revision bigint check(reviewed_context_revision>=0);
alter table public.cloud_pages drop constraint if exists cloud_pages_production_status_check;alter table public.cloud_pages add constraint cloud_pages_production_status_check check(production_status in('not_started','generating','review_required','revision_required','finalized'));create index if not exists cloud_pages_production_status_idx on public.cloud_pages(project_id,production_status,page_number) where deleted_at is null;
create or replace function public.bump_cloud_production_context_revision() returns trigger language plpgsql security definer set search_path=public as $$declare v_project_id uuid:=coalesce(new.project_id,old.project_id);begin update public.cloud_projects set production_context_revision=production_context_revision+1,updated_at=now() where id=v_project_id;return coalesce(new,old);end$$;
drop trigger if exists cloud_character_version_production_context on public.cloud_character_profile_versions;create trigger cloud_character_version_production_context after insert on public.cloud_character_profile_versions for each row execute function public.bump_cloud_production_context_revision();drop trigger if exists cloud_style_version_production_context on public.cloud_style_bible_versions;create trigger cloud_style_version_production_context after insert on public.cloud_style_bible_versions for each row execute function public.bump_cloud_production_context_revision();drop trigger if exists cloud_world_version_production_context on public.cloud_world_profile_versions;create trigger cloud_world_version_production_context after insert on public.cloud_world_profile_versions for each row execute function public.bump_cloud_production_context_revision();drop trigger if exists cloud_visual_reference_production_context on public.cloud_visual_reference_assets;create trigger cloud_visual_reference_production_context after insert or delete on public.cloud_visual_reference_assets for each row execute function public.bump_cloud_production_context_revision();
create or replace function public.set_cloud_page_production_status(p_page_id uuid,p_status text) returns uuid language plpgsql security invoker set search_path=public as $$declare v_page public.cloud_pages%rowtype;v_profile uuid:=public.current_profile_id();v_context bigint;v_project_revision bigint;begin select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null for update;if v_page.id is null or v_profile is null or not public.cloud_project_can_edit(v_page.project_id) or p_status not in('not_started','review_required','revision_required','finalized') then raise exception 'cloud_page_status_invalid';end if;if p_status='finalized' and exists(select 1 from public.cloud_generation_jobs where page_id=p_page_id and status in('queued','running')) then raise exception 'cloud_page_finalize_active_jobs';end if;select production_context_revision into v_context from public.cloud_projects where id=v_page.project_id;update public.cloud_pages set production_status=p_status,production_status_updated_at=now(),production_status_updated_by_profile_id=v_profile,finalized_revision=case when p_status='finalized' then revision else null end,reviewed_context_revision=case when p_status='finalized' then v_context else reviewed_context_revision end where id=p_page_id;update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_project_revision;insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_project_revision,jsonb_build_object('event','page_production_status','pageId',p_page_id,'status',p_status),v_profile);return p_page_id;end$$;
create or replace function public.sync_cloud_page_production_status_from_job() returns trigger language plpgsql security definer set search_path=public as $$declare v_status text;begin if new.page_id is null then return new;end if;select production_status into v_status from public.cloud_pages where id=new.page_id;if v_status='finalized' then raise exception 'cloud_page_finalized';end if;if exists(select 1 from public.cloud_generation_jobs where page_id=new.page_id and status in('queued','running')) then v_status:='generating';elsif exists(select 1 from public.cloud_generation_jobs where page_id=new.page_id and status='failed') then v_status:='revision_required';elsif new.status='completed' then v_status:='review_required';else v_status:=coalesce(v_status,'not_started');end if;update public.cloud_pages set production_status=v_status,production_status_updated_at=now() where id=new.page_id;return new;end$$;
drop trigger if exists cloud_generation_job_page_status on public.cloud_generation_jobs;create trigger cloud_generation_job_page_status after insert or update of status on public.cloud_generation_jobs for each row execute function public.sync_cloud_page_production_status_from_job();revoke all on function public.set_cloud_page_production_status(uuid,text) from public,anon;grant execute on function public.set_cloud_page_production_status(uuid,text) to authenticated,service_role;
create or replace function public.acquire_cloud_page_edit_lock(p_page_id uuid,p_lock_token uuid,p_lease_seconds integer default 120) returns timestamptz language plpgsql security definer set search_path=public as $$declare v_page public.cloud_pages%rowtype;v_profile uuid:=public.current_profile_id();v_expires timestamptz;begin select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null;if v_page.id is null or v_profile is null or not public.cloud_project_can_edit(v_page.project_id) or p_lease_seconds not between 60 and 300 then raise exception 'cloud_page_lock_invalid';end if;if v_page.production_status='finalized' then raise exception 'cloud_page_finalized';end if;insert into public.cloud_page_edit_locks(page_id,project_id,locked_by_profile_id,lock_token,lease_expires_at) values(v_page.id,v_page.project_id,v_profile,p_lock_token,now()+make_interval(secs=>p_lease_seconds)) on conflict(page_id) do update set locked_by_profile_id=excluded.locked_by_profile_id,lock_token=excluded.lock_token,lease_expires_at=excluded.lease_expires_at,updated_at=now() where public.cloud_page_edit_locks.lease_expires_at<=now() or(public.cloud_page_edit_locks.locked_by_profile_id=v_profile and public.cloud_page_edit_locks.lock_token=p_lock_token) returning lease_expires_at into v_expires;if v_expires is null then raise exception 'cloud_page_locked';end if;return v_expires;end$$;
create or replace function public.save_cloud_page_snapshot(p_page_id uuid,p_expected_revision bigint,p_canvas jsonb) returns table(page_id uuid,revision bigint,updated_at timestamptz) language plpgsql security invoker set search_path=public as $$declare v_page public.cloud_pages%rowtype;v_profile_id uuid:=public.current_profile_id();v_project_revision bigint;v_now timestamptz:=clock_timestamp();begin if v_profile_id is null or jsonb_typeof(p_canvas)<>'object' or pg_column_size(p_canvas)>2097152 then raise exception 'invalid_snapshot_input';end if;select * into v_page from public.cloud_pages where id=p_page_id for update;if not found or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'page_not_found';end if;if v_page.production_status='finalized' then raise exception 'cloud_page_finalized';end if;if v_page.revision<>p_expected_revision then raise exception 'revision_conflict:%',v_page.revision;end if;update public.cloud_pages set revision=cloud_pages.revision+1,updated_at=v_now,production_status=case when production_status='not_started' then 'revision_required' else production_status end,production_status_updated_at=v_now where id=p_page_id returning cloud_pages.revision into revision;insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id,created_at) values(v_page.project_id,p_page_id,revision,p_canvas,v_profile_id,v_now);update public.cloud_projects set revision=cloud_projects.revision+1,updated_at=v_now where id=v_page.project_id returning cloud_projects.revision into v_project_revision;insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id,created_at) values(v_page.project_id,v_project_revision,jsonb_build_object('event','page_snapshot','pageId',p_page_id,'pageRevision',revision),v_profile_id,v_now);page_id:=p_page_id;updated_at:=v_now;return next;end$$;

-- Phase M4: resumable segmented manuscript PDF exports.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cloud-exports','cloud-exports',false,524288000,array['application/pdf','image/png','application/zip']::text[]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.cloud_export_jobs(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,created_by_profile_id uuid not null references public.profiles(id) on delete cascade,format text not null default 'pdf' check(format in('pdf')),status text not null default 'queued' check(status in('queued','running','paused','completed','failed','canceled')),page_ids uuid[] not null check(cardinality(page_ids) between 1 and 100),total_pages integer not null check(total_pages between 1 and 100),completed_pages integer not null default 0 check(completed_pages>=0 and completed_pages<=total_pages),segment_size integer not null default 4 check(segment_size between 1 and 8),progress integer not null default 0 check(progress between 0 and 100),output_bucket text check(output_bucket='cloud-exports'),output_storage_path text,output_byte_size bigint check(output_byte_size is null or output_byte_size>=0),attempt_count integer not null default 0 check(attempt_count>=0),max_attempts integer not null default 5 check(max_attempts between 1 and 10),lease_token uuid,lease_expires_at timestamptz,error_code text,created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,updated_at timestamptz not null default now());
create table if not exists public.cloud_export_segments(job_id uuid not null references public.cloud_export_jobs(id) on delete cascade,segment_index integer not null check(segment_index>=0),page_start integer not null check(page_start>=0),page_count integer not null check(page_count between 1 and 8),pdf_storage_path text not null,page_storage_paths jsonb not null default '[]'::jsonb check(jsonb_typeof(page_storage_paths)='array'),created_at timestamptz not null default now(),primary key(job_id,segment_index));
create unique index if not exists cloud_export_jobs_one_active_idx on public.cloud_export_jobs(project_id) where status in('queued','running','paused');
create index if not exists cloud_export_jobs_project_idx on public.cloud_export_jobs(project_id,created_at desc);create index if not exists cloud_export_jobs_claim_idx on public.cloud_export_jobs(status,created_at) where status in('queued','running');alter table public.cloud_export_jobs enable row level security;alter table public.cloud_export_segments enable row level security;grant select on public.cloud_export_jobs,public.cloud_export_segments to authenticated;
drop policy if exists "cloud_export_jobs_owner_read" on public.cloud_export_jobs;create policy "cloud_export_jobs_owner_read" on public.cloud_export_jobs for select using(created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));drop policy if exists "cloud_export_segments_owner_read" on public.cloud_export_segments;create policy "cloud_export_segments_owner_read" on public.cloud_export_segments for select using(exists(select 1 from public.cloud_export_jobs job where job.id=job_id and job.created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(job.project_id)));
create or replace function public.create_cloud_export_job(p_project_id uuid,p_format text default 'pdf') returns uuid language plpgsql security invoker set search_path=public as $$declare v_profile uuid:=public.current_profile_id();v_page_ids uuid[];v_job_id uuid;v_context bigint;begin if v_profile is null or p_format<>'pdf' or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_export_invalid';end if;select production_context_revision into v_context from public.cloud_projects where id=p_project_id and deleted_at is null;select array_agg(id order by page_number) into v_page_ids from public.cloud_pages where project_id=p_project_id and deleted_at is null;if coalesce(cardinality(v_page_ids),0) not between 1 and 100 then raise exception 'cloud_export_page_count_invalid';end if;if exists(select 1 from public.cloud_pages where project_id=p_project_id and deleted_at is null and(production_status<>'finalized' or finalized_revision is distinct from revision or reviewed_context_revision is distinct from v_context)) then raise exception 'cloud_export_pages_not_finalized';end if;if exists(select 1 from public.cloud_generation_jobs where project_id=p_project_id and status in('queued','running')) then raise exception 'cloud_export_generation_active';end if;if exists(select 1 from public.cloud_export_jobs where project_id=p_project_id and status in('queued','running','paused')) then raise exception 'cloud_export_already_active';end if;insert into public.cloud_export_jobs(project_id,created_by_profile_id,format,page_ids,total_pages) values(p_project_id,v_profile,p_format,v_page_ids,cardinality(v_page_ids)) returning id into v_job_id;return v_job_id;end$$;
create or replace function public.set_cloud_export_job_state(p_job_id uuid,p_status text) returns uuid language plpgsql security invoker set search_path=public as $$declare v_job public.cloud_export_jobs%rowtype;begin select * into v_job from public.cloud_export_jobs where id=p_job_id and created_by_profile_id=public.current_profile_id() for update;if v_job.id is null or p_status not in('queued','paused','canceled') then raise exception 'cloud_export_state_invalid';end if;if p_status='paused' and v_job.status not in('queued','running') then raise exception 'cloud_export_state_invalid';end if;if p_status='queued' and v_job.status not in('paused','failed') then raise exception 'cloud_export_state_invalid';end if;if p_status='canceled' and v_job.status not in('queued','running','paused','failed') then raise exception 'cloud_export_state_invalid';end if;update public.cloud_export_jobs set status=p_status,lease_token=null,lease_expires_at=null,error_code=null,finished_at=case when p_status='canceled' then now() else null end,updated_at=now() where id=v_job.id;return v_job.id;end$$;
create or replace function public.claim_cloud_export_job(p_worker_id text,p_lease_seconds integer default 300) returns setof public.cloud_export_jobs language plpgsql security definer set search_path=public as $$declare v_job_id uuid;v_token uuid:=gen_random_uuid();begin if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 60 and 900 then raise exception 'cloud_export_worker_not_authorized';end if;select id into v_job_id from public.cloud_export_jobs where(status='queued' or(status='running' and lease_expires_at<=now())) and completed_pages<total_pages order by created_at for update skip locked limit 1;if v_job_id is null then return;end if;return query update public.cloud_export_jobs set status='running',attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),started_at=coalesce(started_at,now()),error_code=null,updated_at=now() where id=v_job_id returning *;end$$;
create or replace function public.complete_cloud_export_segment(p_job_id uuid,p_lease_token uuid,p_segment_index integer,p_page_count integer,p_pdf_storage_path text,p_page_storage_paths jsonb,p_output_storage_path text default null,p_output_byte_size bigint default null) returns uuid language plpgsql security definer set search_path=public as $$declare v_job public.cloud_export_jobs%rowtype;v_completed integer;begin if auth.role()<>'service_role' or jsonb_typeof(p_page_storage_paths)<>'array' or p_page_count not between 1 and 8 then raise exception 'cloud_export_worker_not_authorized';end if;select * into v_job from public.cloud_export_jobs where id=p_job_id for update;if v_job.id is null or v_job.status<>'running' or v_job.lease_token<>p_lease_token or p_segment_index<>floor(v_job.completed_pages::numeric/v_job.segment_size)::integer or p_page_count>v_job.total_pages-v_job.completed_pages then raise exception 'cloud_export_lease_invalid';end if;insert into public.cloud_export_segments(job_id,segment_index,page_start,page_count,pdf_storage_path,page_storage_paths) values(v_job.id,p_segment_index,v_job.completed_pages,p_page_count,p_pdf_storage_path,p_page_storage_paths) on conflict(job_id,segment_index) do update set page_start=excluded.page_start,page_count=excluded.page_count,pdf_storage_path=excluded.pdf_storage_path,page_storage_paths=excluded.page_storage_paths,created_at=now();v_completed:=v_job.completed_pages+p_page_count;if v_completed=v_job.total_pages and(p_output_storage_path is null or p_output_byte_size is null) then raise exception 'cloud_export_output_required';end if;update public.cloud_export_jobs set completed_pages=v_completed,progress=floor(v_completed*100.0/total_pages)::integer,status=case when v_completed=total_pages then 'completed' else 'queued' end,output_bucket=case when v_completed=total_pages then 'cloud-exports' else output_bucket end,output_storage_path=coalesce(p_output_storage_path,output_storage_path),output_byte_size=coalesce(p_output_byte_size,output_byte_size),attempt_count=0,lease_token=null,lease_expires_at=null,finished_at=case when v_completed=total_pages then now() else null end,updated_at=now() where id=v_job.id;return v_job.id;end$$;
create or replace function public.fail_cloud_export_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean) returns uuid language plpgsql security definer set search_path=public as $$declare v_job public.cloud_export_jobs%rowtype;v_retry boolean;begin if auth.role()<>'service_role' then raise exception 'cloud_export_worker_not_authorized';end if;select * into v_job from public.cloud_export_jobs where id=p_job_id for update;if v_job.id is null or v_job.status<>'running' or v_job.lease_token<>p_lease_token then raise exception 'cloud_export_lease_invalid';end if;v_retry:=p_retryable and v_job.attempt_count<v_job.max_attempts;update public.cloud_export_jobs set status=case when v_retry then 'queued' else 'failed' end,error_code=left(coalesce(p_error_code,'export_failed'),100),lease_token=null,lease_expires_at=null,finished_at=case when v_retry then null else now() end,updated_at=now() where id=v_job.id;return v_job.id;end$$;
revoke all on function public.create_cloud_export_job(uuid,text),public.set_cloud_export_job_state(uuid,text),public.claim_cloud_export_job(text,integer),public.complete_cloud_export_segment(uuid,uuid,integer,integer,text,jsonb,text,bigint),public.fail_cloud_export_job(uuid,uuid,text,boolean) from public,anon;grant execute on function public.create_cloud_export_job(uuid,text),public.set_cloud_export_job_state(uuid,text) to authenticated,service_role;grant execute on function public.claim_cloud_export_job(text,integer),public.complete_cloud_export_segment(uuid,uuid,integer,integer,text,jsonb,text,bigint),public.fail_cloud_export_job(uuid,uuid,text,boolean) to service_role;
alter function public.create_cloud_export_job(uuid,text) security definer;
alter function public.set_cloud_export_job_state(uuid,text) security definer;

-- Phase M4: private page thumbnails and bounded intermediate artifact cleanup.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cloud-cache','cloud-cache',false,5242880,array['image/webp']::text[]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.cloud_page_thumbnails(page_id uuid primary key references public.cloud_pages(id) on delete cascade,project_id uuid not null references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,source_revision bigint not null default 0 check(source_revision>=0),status text not null default 'queued' check(status in('queued','running','ready','failed')),bucket_id text not null default 'cloud-cache' check(bucket_id='cloud-cache'),storage_path text,width integer check(width is null or width between 1 and 640),height integer check(height is null or height between 1 and 960),attempt_count integer not null default 0 check(attempt_count>=0),max_attempts integer not null default 5 check(max_attempts between 1 and 10),lease_token uuid,lease_expires_at timestamptz,error_code text,generated_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.cloud_storage_cleanup(id uuid primary key default gen_random_uuid(),bucket_id text not null check(bucket_id in('cloud-cache','cloud-exports')),storage_path text not null,reason text not null check(reason in('replaced_thumbnail','stale_thumbnail','export_intermediate','abandoned_export')),status text not null default 'pending' check(status in('pending','running','resolved','failed')),attempt_count integer not null default 0 check(attempt_count>=0),max_attempts integer not null default 5 check(max_attempts between 1 and 10),not_before timestamptz not null default now(),lease_token uuid,lease_expires_at timestamptz,error_code text,created_at timestamptz not null default now(),resolved_at timestamptz,updated_at timestamptz not null default now(),unique(bucket_id,storage_path));
create index if not exists cloud_page_thumbnails_claim_idx on public.cloud_page_thumbnails(status,updated_at) where status in('queued','running');create index if not exists cloud_page_thumbnails_project_idx on public.cloud_page_thumbnails(project_id,page_id);create index if not exists cloud_storage_cleanup_claim_idx on public.cloud_storage_cleanup(status,not_before) where status in('pending','running');
alter table public.cloud_page_thumbnails enable row level security;alter table public.cloud_storage_cleanup enable row level security;grant select on public.cloud_page_thumbnails to authenticated;
drop policy if exists "cloud_page_thumbnails_owner_read" on public.cloud_page_thumbnails;create policy "cloud_page_thumbnails_owner_read" on public.cloud_page_thumbnails for select using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));
drop policy if exists "cloud_cache_storage_read" on storage.objects;create policy "cloud_cache_storage_read" on storage.objects for select using(bucket_id='cloud-cache' and(storage.foldername(name))[1]=public.current_profile_id()::text and case when(storage.foldername(name))[2]~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_read(((storage.foldername(name))[2])::uuid) else false end);
create or replace function public.queue_cloud_page_thumbnail() returns trigger language plpgsql security definer set search_path=public as $$declare v_owner uuid;begin select owner_profile_id into v_owner from public.cloud_projects where id=new.project_id;insert into public.cloud_page_thumbnails(page_id,project_id,owner_profile_id,source_revision,status,error_code,lease_token,lease_expires_at,updated_at) values(new.page_id,new.project_id,v_owner,new.revision,'queued',null,null,null,now()) on conflict(page_id) do update set source_revision=excluded.source_revision,status=case when public.cloud_page_thumbnails.status='running' then 'running' else 'queued' end,error_code=null,lease_token=case when public.cloud_page_thumbnails.status='running' then public.cloud_page_thumbnails.lease_token else null end,lease_expires_at=case when public.cloud_page_thumbnails.status='running' then public.cloud_page_thumbnails.lease_expires_at else null end,updated_at=now() where public.cloud_page_thumbnails.source_revision<=excluded.source_revision;return new;end$$;
drop trigger if exists cloud_canvas_snapshot_thumbnail_queue on public.cloud_canvas_snapshots;create trigger cloud_canvas_snapshot_thumbnail_queue after insert on public.cloud_canvas_snapshots for each row execute function public.queue_cloud_page_thumbnail();
insert into public.cloud_page_thumbnails(page_id,project_id,owner_profile_id,source_revision,status) select page.id,page.project_id,project.owner_profile_id,page.revision,'queued' from public.cloud_pages page join public.cloud_projects project on project.id=page.project_id where page.deleted_at is null and project.deleted_at is null on conflict(page_id) do nothing;
create or replace function public.claim_cloud_page_thumbnail(p_worker_id text,p_lease_seconds integer default 300) returns setof public.cloud_page_thumbnails language plpgsql security definer set search_path=public as $$declare v_page_id uuid;v_token uuid:=gen_random_uuid();begin if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 60 and 900 then raise exception 'cloud_thumbnail_worker_not_authorized';end if;select page_id into v_page_id from public.cloud_page_thumbnails where(status='queued' or(status='running' and lease_expires_at<=now())) and attempt_count<max_attempts order by updated_at for update skip locked limit 1;if v_page_id is null then return;end if;return query update public.cloud_page_thumbnails set status='running',attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),error_code=null,updated_at=now() where page_id=v_page_id returning *;end$$;
create or replace function public.complete_cloud_page_thumbnail(p_page_id uuid,p_lease_token uuid,p_source_revision bigint,p_storage_path text,p_width integer,p_height integer) returns text language plpgsql security definer set search_path=public as $$declare v_row public.cloud_page_thumbnails%rowtype;v_old_path text;v_current_revision bigint;begin if auth.role()<>'service_role' or p_storage_path is null or p_width not between 1 and 640 or p_height not between 1 and 960 then raise exception 'cloud_thumbnail_worker_not_authorized';end if;select * into v_row from public.cloud_page_thumbnails where page_id=p_page_id for update;select revision into v_current_revision from public.cloud_pages where id=p_page_id and deleted_at is null;if v_row.page_id is null or v_row.status<>'running' or v_row.lease_token<>p_lease_token then raise exception 'cloud_thumbnail_lease_invalid';end if;if v_current_revision is distinct from p_source_revision or v_row.source_revision is distinct from p_source_revision then insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason) values('cloud-cache',p_storage_path,'stale_thumbnail') on conflict(bucket_id,storage_path) do nothing;update public.cloud_page_thumbnails set status='queued',source_revision=coalesce(v_current_revision,source_revision),lease_token=null,lease_expires_at=null,updated_at=now() where page_id=p_page_id;return 'stale';end if;v_old_path:=v_row.storage_path;update public.cloud_page_thumbnails set status='ready',storage_path=p_storage_path,width=p_width,height=p_height,attempt_count=0,lease_token=null,lease_expires_at=null,error_code=null,generated_at=now(),updated_at=now() where page_id=p_page_id;if v_old_path is not null and v_old_path<>p_storage_path then insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason) values('cloud-cache',v_old_path,'replaced_thumbnail') on conflict(bucket_id,storage_path) do nothing;end if;return 'ready';end$$;
create or replace function public.fail_cloud_page_thumbnail(p_page_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean) returns uuid language plpgsql security definer set search_path=public as $$declare v_row public.cloud_page_thumbnails%rowtype;v_retry boolean;begin if auth.role()<>'service_role' then raise exception 'cloud_thumbnail_worker_not_authorized';end if;select * into v_row from public.cloud_page_thumbnails where page_id=p_page_id for update;if v_row.page_id is null or v_row.status<>'running' or v_row.lease_token<>p_lease_token then raise exception 'cloud_thumbnail_lease_invalid';end if;v_retry:=p_retryable and v_row.attempt_count<v_row.max_attempts;update public.cloud_page_thumbnails set status=case when v_retry then 'queued' else 'failed' end,error_code=left(coalesce(p_error_code,'thumbnail_failed'),100),lease_token=null,lease_expires_at=null,updated_at=now() where page_id=p_page_id;return p_page_id;end$$;
create or replace function public.queue_expired_cloud_storage_artifacts() returns integer language plpgsql security definer set search_path=public as $$declare v_count integer:=0;v_added integer:=0;begin if auth.role()<>'service_role' then raise exception 'cloud_storage_cleanup_not_authorized';end if;insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before) select 'cloud-exports',path,'export_intermediate',now() from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id cross join lateral jsonb_array_elements_text(segment.page_storage_paths) path where job.status='completed' and job.finished_at<now()-interval '24 hours' on conflict(bucket_id,storage_path) do nothing;get diagnostics v_count=row_count;insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before) select 'cloud-exports',segment.pdf_storage_path,'export_intermediate',now() from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id where job.status='completed' and job.finished_at<now()-interval '24 hours' on conflict(bucket_id,storage_path) do nothing;get diagnostics v_added=row_count;v_count:=v_count+v_added;insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before) select 'cloud-exports',path,'abandoned_export',now() from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id cross join lateral jsonb_array_elements_text(segment.page_storage_paths) path where job.status in('failed','canceled') and job.finished_at<now()-interval '7 days' on conflict(bucket_id,storage_path) do nothing;get diagnostics v_added=row_count;v_count:=v_count+v_added;insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before) select 'cloud-exports',segment.pdf_storage_path,'abandoned_export',now() from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id where job.status in('failed','canceled') and job.finished_at<now()-interval '7 days' on conflict(bucket_id,storage_path) do nothing;get diagnostics v_added=row_count;v_count:=v_count+v_added;return v_count;end$$;
create or replace function public.claim_cloud_storage_cleanup(p_worker_id text,p_lease_seconds integer default 300) returns setof public.cloud_storage_cleanup language plpgsql security definer set search_path=public as $$declare v_id uuid;v_token uuid:=gen_random_uuid();begin if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 60 and 900 then raise exception 'cloud_storage_cleanup_not_authorized';end if;select id into v_id from public.cloud_storage_cleanup where not_before<=now() and(status='pending' or(status='running' and lease_expires_at<=now())) and attempt_count<max_attempts order by not_before,created_at for update skip locked limit 1;if v_id is null then return;end if;return query update public.cloud_storage_cleanup set status='running',attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),error_code=null,updated_at=now() where id=v_id returning *;end$$;
create or replace function public.complete_cloud_storage_cleanup(p_id uuid,p_lease_token uuid) returns uuid language plpgsql security definer set search_path=public as $$begin if auth.role()<>'service_role' then raise exception 'cloud_storage_cleanup_not_authorized';end if;update public.cloud_storage_cleanup set status='resolved',lease_token=null,lease_expires_at=null,error_code=null,resolved_at=now(),updated_at=now() where id=p_id and status='running' and lease_token=p_lease_token;if not found then raise exception 'cloud_storage_cleanup_lease_invalid';end if;return p_id;end$$;
create or replace function public.fail_cloud_storage_cleanup(p_id uuid,p_lease_token uuid,p_error_code text) returns uuid language plpgsql security definer set search_path=public as $$begin if auth.role()<>'service_role' then raise exception 'cloud_storage_cleanup_not_authorized';end if;update public.cloud_storage_cleanup set status=case when attempt_count<max_attempts then 'pending' else 'failed' end,not_before=now()+interval '15 minutes',lease_token=null,lease_expires_at=null,error_code=left(coalesce(p_error_code,'storage_cleanup_failed'),100),updated_at=now() where id=p_id and status='running' and lease_token=p_lease_token;if not found then raise exception 'cloud_storage_cleanup_lease_invalid';end if;return p_id;end$$;
revoke all on function public.claim_cloud_page_thumbnail(text,integer),public.complete_cloud_page_thumbnail(uuid,uuid,bigint,text,integer,integer),public.fail_cloud_page_thumbnail(uuid,uuid,text,boolean),public.queue_expired_cloud_storage_artifacts(),public.claim_cloud_storage_cleanup(text,integer),public.complete_cloud_storage_cleanup(uuid,uuid),public.fail_cloud_storage_cleanup(uuid,uuid,text) from public,anon,authenticated;grant execute on function public.claim_cloud_page_thumbnail(text,integer),public.complete_cloud_page_thumbnail(uuid,uuid,bigint,text,integer,integer),public.fail_cloud_page_thumbnail(uuid,uuid,text,boolean),public.queue_expired_cloud_storage_artifacts(),public.claim_cloud_storage_cleanup(text,integer),public.complete_cloud_storage_cleanup(uuid,uuid),public.fail_cloud_storage_cleanup(uuid,uuid,text) to service_role;

-- Phase M5: narrative continuity facts and plot threads.
create table if not exists public.cloud_continuity_facts(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,fact_kind text not null check(fact_kind in('appearance','location','relationship','timeline','prop','speech')),subject text not null check(char_length(trim(subject)) between 1 and 100),attribute text not null check(char_length(trim(attribute)) between 1 and 100),fact_value text not null check(char_length(trim(fact_value)) between 1 and 500),start_page integer not null check(start_page between 1 and 1000),end_page integer not null check(end_page between start_page and 1000),source_page integer check(source_page is null or source_page between start_page and end_page),notes text not null default '' check(char_length(notes)<=1000),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.cloud_plot_threads(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,title text not null check(char_length(trim(title)) between 1 and 150),setup_page integer not null check(setup_page between 1 and 1000),target_payoff_page integer check(target_payoff_page is null or target_payoff_page between setup_page and 1000),payoff_page integer check(payoff_page is null or payoff_page between setup_page and 1000),status text not null default 'planned' check(status in('planned','planted','resolved','dropped')),notes text not null default '' check(char_length(notes)<=1000),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists cloud_continuity_facts_project_range_idx on public.cloud_continuity_facts(project_id,start_page,end_page);create index if not exists cloud_plot_threads_project_status_idx on public.cloud_plot_threads(project_id,status,target_payoff_page);alter table public.cloud_continuity_facts enable row level security;alter table public.cloud_plot_threads enable row level security;grant select on public.cloud_continuity_facts,public.cloud_plot_threads to authenticated;grant select,insert,update,delete on public.cloud_continuity_facts,public.cloud_plot_threads to service_role;
drop policy if exists "cloud_continuity_facts_owner_read" on public.cloud_continuity_facts;create policy "cloud_continuity_facts_owner_read" on public.cloud_continuity_facts for select using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));drop policy if exists "cloud_plot_threads_owner_read" on public.cloud_plot_threads;create policy "cloud_plot_threads_owner_read" on public.cloud_plot_threads for select using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));
create or replace function public.save_cloud_continuity_fact(p_project_id uuid,p_fact_id uuid,p_fact_kind text,p_subject text,p_attribute text,p_fact_value text,p_start_page integer,p_end_page integer,p_source_page integer,p_notes text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid:=coalesce(p_fact_id,gen_random_uuid());begin if v_owner is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_continuity_project_not_found';end if;if p_fact_kind not in('appearance','location','relationship','timeline','prop','speech') or char_length(trim(coalesce(p_subject,''))) not between 1 and 100 or char_length(trim(coalesce(p_attribute,''))) not between 1 and 100 or char_length(trim(coalesce(p_fact_value,''))) not between 1 and 500 or p_start_page not between 1 and 1000 or p_end_page not between p_start_page and 1000 or(p_source_page is not null and p_source_page not between p_start_page and p_end_page)or char_length(coalesce(p_notes,''))>1000 then raise exception 'cloud_continuity_fact_invalid';end if;insert into public.cloud_continuity_facts(id,project_id,owner_profile_id,fact_kind,subject,attribute,fact_value,start_page,end_page,source_page,notes) values(v_id,p_project_id,v_owner,p_fact_kind,trim(p_subject),trim(p_attribute),trim(p_fact_value),p_start_page,p_end_page,p_source_page,trim(coalesce(p_notes,''))) on conflict(id) do update set fact_kind=excluded.fact_kind,subject=excluded.subject,attribute=excluded.attribute,fact_value=excluded.fact_value,start_page=excluded.start_page,end_page=excluded.end_page,source_page=excluded.source_page,notes=excluded.notes,updated_at=now() where cloud_continuity_facts.project_id=p_project_id and cloud_continuity_facts.owner_profile_id=v_owner;if not found then raise exception 'cloud_continuity_fact_not_found';end if;return v_id;end$$;
create or replace function public.delete_cloud_continuity_fact(p_project_id uuid,p_fact_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin delete from public.cloud_continuity_facts where id=p_fact_id and project_id=p_project_id and owner_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id);if not found then raise exception 'cloud_continuity_fact_not_found';end if;end$$;
create or replace function public.save_cloud_plot_thread(p_project_id uuid,p_thread_id uuid,p_title text,p_setup_page integer,p_target_payoff_page integer,p_payoff_page integer,p_status text,p_notes text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid:=coalesce(p_thread_id,gen_random_uuid());begin if v_owner is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_continuity_project_not_found';end if;if char_length(trim(coalesce(p_title,''))) not between 1 and 150 or p_setup_page not between 1 and 1000 or(p_target_payoff_page is not null and p_target_payoff_page not between p_setup_page and 1000)or(p_payoff_page is not null and p_payoff_page not between p_setup_page and 1000)or p_status not in('planned','planted','resolved','dropped')or char_length(coalesce(p_notes,''))>1000 then raise exception 'cloud_plot_thread_invalid';end if;insert into public.cloud_plot_threads(id,project_id,owner_profile_id,title,setup_page,target_payoff_page,payoff_page,status,notes) values(v_id,p_project_id,v_owner,trim(p_title),p_setup_page,p_target_payoff_page,p_payoff_page,p_status,trim(coalesce(p_notes,''))) on conflict(id) do update set title=excluded.title,setup_page=excluded.setup_page,target_payoff_page=excluded.target_payoff_page,payoff_page=excluded.payoff_page,status=excluded.status,notes=excluded.notes,updated_at=now() where cloud_plot_threads.project_id=p_project_id and cloud_plot_threads.owner_profile_id=v_owner;if not found then raise exception 'cloud_plot_thread_not_found';end if;return v_id;end$$;
create or replace function public.delete_cloud_plot_thread(p_project_id uuid,p_thread_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin delete from public.cloud_plot_threads where id=p_thread_id and project_id=p_project_id and owner_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id);if not found then raise exception 'cloud_plot_thread_not_found';end if;end$$;
revoke all on function public.save_cloud_continuity_fact(uuid,uuid,text,text,text,text,integer,integer,integer,text),public.delete_cloud_continuity_fact(uuid,uuid),public.save_cloud_plot_thread(uuid,uuid,text,integer,integer,integer,text,text),public.delete_cloud_plot_thread(uuid,uuid) from public,anon;grant execute on function public.save_cloud_continuity_fact(uuid,uuid,text,text,text,text,integer,integer,integer,text),public.delete_cloud_continuity_fact(uuid,uuid),public.save_cloud_plot_thread(uuid,uuid,text,integer,integer,integer,text,text),public.delete_cloud_plot_thread(uuid,uuid) to authenticated,service_role;

-- Phase M5: chapter-level production priorities, owners and due dates.
create table if not exists public.cloud_chapter_production_plans(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.cloud_projects(id) on delete cascade,chapter_id uuid not null references public.cloud_chapters(id) on delete cascade,owner_profile_id uuid not null references public.profiles(id) on delete cascade,priority text not null default 'normal' check(priority in('low','normal','high','urgent')),assignee_name text not null default '' check(char_length(assignee_name)<=100),due_date date,notes text not null default '' check(char_length(notes)<=1000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(project_id,chapter_id));
create index if not exists cloud_chapter_production_plans_due_idx on public.cloud_chapter_production_plans(project_id,due_date,priority);alter table public.cloud_chapter_production_plans enable row level security;grant select on public.cloud_chapter_production_plans to authenticated;grant select,insert,update,delete on public.cloud_chapter_production_plans to service_role;
drop policy if exists "cloud_chapter_production_plans_owner_read" on public.cloud_chapter_production_plans;create policy "cloud_chapter_production_plans_owner_read" on public.cloud_chapter_production_plans for select using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));
create or replace function public.save_cloud_chapter_production_plan(p_project_id uuid,p_chapter_id uuid,p_priority text,p_assignee_name text,p_due_date date,p_notes text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_owner uuid:=public.current_profile_id();v_id uuid;begin if v_owner is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_chapter_plan_project_not_found';end if;if not exists(select 1 from public.cloud_chapters where id=p_chapter_id and project_id=p_project_id) then raise exception 'cloud_chapter_plan_chapter_not_found';end if;if p_priority not in('low','normal','high','urgent')or char_length(trim(coalesce(p_assignee_name,'')))>100 or char_length(trim(coalesce(p_notes,'')))>1000 then raise exception 'cloud_chapter_plan_invalid';end if;insert into public.cloud_chapter_production_plans(project_id,chapter_id,owner_profile_id,priority,assignee_name,due_date,notes) values(p_project_id,p_chapter_id,v_owner,p_priority,trim(coalesce(p_assignee_name,'')),p_due_date,trim(coalesce(p_notes,''))) on conflict(project_id,chapter_id) do update set priority=excluded.priority,assignee_name=excluded.assignee_name,due_date=excluded.due_date,notes=excluded.notes,updated_at=now() where cloud_chapter_production_plans.owner_profile_id=v_owner returning id into v_id;if v_id is null then raise exception 'cloud_chapter_plan_not_found';end if;return v_id;end$$;
revoke all on function public.save_cloud_chapter_production_plan(uuid,uuid,text,text,date,text) from public,anon;grant execute on function public.save_cloud_chapter_production_plan(uuid,uuid,text,text,date,text) to authenticated,service_role;
