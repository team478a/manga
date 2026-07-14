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

create index if not exists works_source_project_id_idx
on public.works (source_project_id)
where source_project_id is not null;

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
for select using (is_public = true or creator_id = public.current_profile_id() or public.is_admin());

create policy "works_creator_insert" on public.works
for insert with check (creator_id = public.current_profile_id());

create policy "works_creator_update" on public.works
for update using (creator_id = public.current_profile_id() or public.is_admin())
with check (creator_id = public.current_profile_id() or public.is_admin());

create policy "works_creator_delete" on public.works
for delete using (creator_id = public.current_profile_id() or public.is_admin());

drop policy if exists "products_public_read_active" on public.digital_products;
drop policy if exists "products_creator_insert" on public.digital_products;
drop policy if exists "products_creator_update" on public.digital_products;

create policy "products_public_read_active" on public.digital_products
for select using (
  status = 'active'
  or creator_id = public.current_profile_id()
  or public.is_admin()
);

create policy "products_creator_insert" on public.digital_products
for insert with check (
  creator_id = public.current_profile_id()
  and exists (
    select 1 from public.works
    where works.id = digital_products.work_id
      and works.creator_id = public.current_profile_id()
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
for insert with check (bucket_id = 'works' and auth.role() = 'authenticated');

drop policy if exists "works_creator_update" on storage.objects;
create policy "works_creator_update" on storage.objects
for update using (bucket_id = 'works' and auth.role() = 'authenticated')
with check (bucket_id = 'works' and auth.role() = 'authenticated');

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
