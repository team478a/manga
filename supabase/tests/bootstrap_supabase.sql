\set ON_ERROR_STOP on

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists vault;

create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  secret text not null,
  name text unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view vault.decrypted_secrets as
select
  id,
  secret,
  secret as decrypted_secret,
  name,
  description,
  created_at,
  updated_at
from vault.secrets;

create or replace function vault.create_secret(
  new_secret text,
  new_name text default null,
  new_description text default null
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into vault.secrets(secret, name, description)
  values (new_secret, new_name, new_description)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function vault.update_secret(
  secret_id uuid,
  new_secret text default null,
  new_name text default null,
  new_description text default null
)
returns void
language plpgsql
as $$
begin
  update vault.secrets
  set secret = coalesce(new_secret, secret),
      name = coalesce(new_name, name),
      description = coalesce(new_description, description),
      updated_at = now()
  where id = secret_id;
end;
$$;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')::text
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null default '',
  owner_id text
);

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;

grant usage on schema auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role(), storage.foldername(text)
to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects
to anon, authenticated, service_role;

alter table storage.objects enable row level security;
