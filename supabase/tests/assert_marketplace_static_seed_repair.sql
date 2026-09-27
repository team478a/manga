\set ON_ERROR_STOP on

-- Supabase Preview Branches can contain the cloned schema without static rows
-- or Storage configuration. Reproduce that state in the disposable CI DB.
drop policy if exists "digital_products_creator_delete" on storage.objects;
drop policy if exists "digital_products_creator_update" on storage.objects;
drop policy if exists "digital_products_creator_upload" on storage.objects;
drop policy if exists "works_creator_delete" on storage.objects;
drop policy if exists "works_creator_update" on storage.objects;
drop policy if exists "works_creator_upload" on storage.objects;
drop policy if exists "works_public_read" on storage.objects;

delete from storage.buckets where id in ('works','digital-products');
delete from public.cloud_ai_settings where singleton;
delete from public.cloud_ai_plans where plan_key in ('free','trial','creator');

\ir ../migrations/202609280001_marketplace_static_seed.sql

do $$
begin
  if (
    select count(*)
    from public.cloud_ai_plans
    where plan_key in ('free','trial','creator')
  ) <> 3 then
    raise exception 'Marketplace static seed did not restore Cloud AI plans';
  end if;

  if not exists (
    select 1 from public.cloud_ai_settings where singleton
  ) then
    raise exception 'Marketplace static seed did not restore Cloud AI settings';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id='works' and public and file_size_limit=10485760
  ) or not exists (
    select 1 from storage.buckets
    where id='digital-products' and not public and file_size_limit=52428800
  ) then
    raise exception 'Marketplace static seed did not restore Storage buckets';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname in (
        'works_public_read',
        'works_creator_upload',
        'works_creator_update',
        'works_creator_delete',
        'digital_products_creator_upload',
        'digital_products_creator_update',
        'digital_products_creator_delete'
      )
  ) <> 7 then
    raise exception 'Marketplace static seed did not restore Storage policies';
  end if;
end
$$;
