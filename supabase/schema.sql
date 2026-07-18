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

alter table public.works
add column if not exists content_class text not null default 'adult';

update public.works
set content_class = case
  when tags && array['全年齢','12歳以上','15歳以上']::text[] then 'general'
  else 'adult'
end;

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
  and (storage.foldername(name))[1] = 'general'
);

drop policy if exists "works_creator_update" on storage.objects;
create policy "works_creator_update" on storage.objects
for update using (
  bucket_id = 'works'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = 'general'
)
with check (
  bucket_id = 'works'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = 'general'
);

drop policy if exists "works_creator_delete" on storage.objects;
create policy "works_creator_delete" on storage.objects
for delete using (
  bucket_id = 'works'
  and owner_id = auth.uid()::text
);

drop policy if exists "digital_products_creator_upload" on storage.objects;
create policy "digital_products_creator_upload" on storage.objects
for insert with check (bucket_id = 'digital-products' and auth.role() = 'authenticated');

drop policy if exists "digital_products_creator_update" on storage.objects;
create policy "digital_products_creator_update" on storage.objects
for update using (bucket_id = 'digital-products' and auth.role() = 'authenticated')
with check (bucket_id = 'digital-products' and auth.role() = 'authenticated');

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
create or replace function public.finish_cloud_generation_job(p_job_id uuid,p_lease_token uuid,p_succeeded boolean,p_output jsonb default null,p_output_asset_id uuid default null,p_provider_job_id text default null,p_actual_cost_micros bigint default null,p_error_code text default null,p_error_message text default null,p_retryable boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_generation_jobs%rowtype; begin if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if; select * into v_job from public.cloud_generation_jobs where id=p_job_id and status='running' and lease_token=p_lease_token for update; if not found then raise exception 'cloud_generation_lease_invalid'; end if; if p_output_asset_id is not null and not exists(select 1 from public.cloud_assets where id=p_output_asset_id and project_id=v_job.project_id) then raise exception 'cloud_generation_output_asset_invalid'; end if;
if p_succeeded then update public.cloud_generation_jobs set status='completed',progress=100,output=coalesce(p_output,'{}'::jsonb),output_asset_id=p_output_asset_id,provider_job_id=p_provider_job_id,actual_cost_micros=p_actual_cost_micros,error_code=null,error_message=null,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=p_job_id;
elsif p_retryable and v_job.attempt_count<v_job.max_attempts then update public.cloud_generation_jobs set status='queued',progress=0,provider_job_id=p_provider_job_id,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,retry_at=now()+make_interval(secs=>5*power(2,v_job.attempt_count-1)::integer),updated_at=now() where id=p_job_id;
else update public.cloud_generation_jobs set status='failed',provider_job_id=p_provider_job_id,actual_cost_micros=p_actual_cost_micros,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=p_job_id; end if; return p_job_id; end $$;
revoke execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) from public,anon; revoke execute on function public.cancel_cloud_generation_job(uuid) from public,anon; revoke execute on function public.claim_cloud_generation_job(text,integer) from public,anon,authenticated; revoke execute on function public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) to authenticated,service_role; grant execute on function public.cancel_cloud_generation_job(uuid) to authenticated,service_role; grant execute on function public.claim_cloud_generation_job(text,integer) to service_role; grant execute on function public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean) to service_role;
