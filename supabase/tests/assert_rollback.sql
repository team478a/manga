\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name in ('sample_image_urls', 'source_project_id')
  ) then
    raise exception 'sales package columns remain after rollback';
  end if;
  if to_regclass('public.desktop_device_authorizations') is not null
     or to_regclass('public.desktop_device_rate_limits') is not null then
    raise exception 'Desktop device tables remain after rollback';
  end if;
  if to_regprocedure('public.consume_desktop_device_rate_limit(text,integer,integer)') is not null
     or to_regprocedure('public.cleanup_desktop_device_authorizations()') is not null then
    raise exception 'Desktop device functions remain after rollback';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('works_creator_delete', 'digital_products_creator_delete')
  ) then
    raise exception 'sales package storage policies remain after rollback';
  end if;
end $$;
