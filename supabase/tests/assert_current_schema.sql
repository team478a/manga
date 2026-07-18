\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.works') is null
     or to_regclass('public.digital_products') is null
     or to_regclass('public.desktop_device_authorizations') is null
     or to_regclass('public.desktop_device_rate_limits') is null then
    raise exception 'current schema is incomplete';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.works'::regclass
      and relrowsecurity
  ) then
    raise exception 'works RLS is disabled';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'works'
      and policyname = 'works_public_read'
  ) then
    raise exception 'works public read policy is missing';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'works' and public = true
  ) then
    raise exception 'works storage bucket is missing';
  end if;
  if to_regclass('public.cloud_projects') is null
     or to_regclass('public.cloud_pages') is null
     or to_regclass('public.cloud_canvas_snapshots') is null then
    raise exception 'Cloud Creator Phase 1 schema is missing';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'cloud-assets' and public = false and file_size_limit = 20971520
  ) then
    raise exception 'private Cloud Asset bucket is missing';
  end if;
end $$;
