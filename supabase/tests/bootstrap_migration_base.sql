\set ON_ERROR_STOP on

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'creator'
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  tags text[] not null default '{}',
  status text not null default 'draft',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.digital_products (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  description text,
  file_url text,
  price integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goods_requests (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.digital_products(id),
  creator_id uuid not null references public.profiles(id),
  amount integer not null default 0,
  platform_fee integer not null default 0,
  creator_revenue integer not null default 0,
  status text not null default 'pending'
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_profile_id()
returns uuid language sql stable as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
$$;

alter table public.works enable row level security;
alter table public.digital_products enable row level security;
alter table public.goods_requests enable row level security;
alter table public.orders enable row level security;

grant select on public.profiles to anon, authenticated;

insert into storage.buckets(id,name,public) values
('works','works',true),('digital-products','digital-products',false)
on conflict(id) do nothing;
