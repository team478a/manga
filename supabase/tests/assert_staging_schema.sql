\set ON_ERROR_STOP on

begin transaction read only;

do $$
declare
  v_server_version integer := current_setting('server_version_num')::integer;
begin
  if v_server_version < 150000 then
    raise exception 'PostgreSQL 15 or newer is required; server_version_num=%', v_server_version;
  end if;

  if to_regclass('public.profiles') is null
     or to_regclass('public.works') is null
     or to_regclass('public.digital_products') is null
     or to_regclass('public.desktop_device_authorizations') is null
     or to_regclass('public.desktop_device_rate_limits') is null then
    raise exception 'required MANGAI Hub tables are missing';
  end if;
  if to_regclass('public.cloud_projects') is null
     or to_regclass('public.cloud_episodes') is null
     or to_regclass('public.cloud_pages') is null
     or to_regclass('public.cloud_assets') is null
     or to_regclass('public.cloud_canvas_snapshots') is null
     or to_regclass('public.cloud_project_versions') is null
     or to_regclass('public.cloud_generation_jobs') is null then
    raise exception 'Cloud Creator and Cloud AI tables are missing';
  end if;
  if to_regclass('public.cloud_ai_plans') is null
     or to_regclass('public.cloud_ai_entitlements') is null
     or to_regclass('public.cloud_ai_usage_periods') is null
     or to_regclass('public.cloud_ai_cost_ledger') is null
     or to_regclass('public.cloud_ai_rate_limits') is null then
    raise exception 'Cloud AI billing tables are missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'sample_image_urls'
      and data_type = 'ARRAY'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'source_project_id'
      and data_type = 'uuid'
  ) then
    raise exception 'sales package columns are missing or have unexpected types';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'content_class'
      and data_type = 'text'
  ) or not exists (
    select 1 from pg_constraint
    where conname = 'works_content_class_check'
      and conrelid = 'public.works'::regclass
  ) then
    raise exception 'content class boundary is missing';
  end if;

  if to_regprocedure('public.consume_desktop_device_rate_limit(text,integer,integer)') is null
     or to_regprocedure('public.cleanup_desktop_device_authorizations()') is null then
    raise exception 'Desktop device functions are missing';
  end if;
  if to_regprocedure('public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)') is null
     or to_regprocedure('public.claim_cloud_generation_job(text,integer)') is null
     or to_regprocedure('public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean)') is null then
    raise exception 'Cloud AI queue functions are missing';
  end if;
  if has_function_privilege('authenticated', 'public.claim_cloud_generation_job(text,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.claim_cloud_generation_job(text,integer)', 'execute') then
    raise exception 'Cloud AI worker privileges are invalid';
  end if;
  if to_regprocedure('public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.consume_cloud_ai_rate_limit(text,text,integer,integer)') is null
     or has_function_privilege('authenticated','public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)','execute')
     or not has_function_privilege('authenticated','public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)','execute')
     or has_function_privilege('authenticated','public.consume_cloud_ai_rate_limit(text,text,integer,integer)','execute') then
    raise exception 'Cloud AI billing function privileges are invalid';
  end if;

  if has_function_privilege('anon', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute')
     or has_function_privilege('anon', 'public.cleanup_desktop_device_authorizations()', 'execute')
     or has_function_privilege('authenticated', 'public.cleanup_desktop_device_authorizations()', 'execute')
     or not has_function_privilege('service_role', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.cleanup_desktop_device_authorizations()', 'execute') then
    raise exception 'Desktop device function privileges are invalid';
  end if;

  if to_regclass('public.works_source_project_id_idx') is null
     or to_regclass('public.desktop_device_authorizations_profile_idx') is null
     or to_regclass('public.desktop_device_authorizations_expiry_idx') is null then
    raise exception 'required MANGAI Hub indexes are missing';
  end if;
  if to_regclass('public.works_general_public_idx') is null then
    raise exception 'general works index is missing';
  end if;

  if exists (
    select 1
    from (values
      ('works'),
      ('digital_products'),
      ('desktop_device_authorizations'),
      ('desktop_device_rate_limits'),
      ('cloud_projects'),
      ('cloud_project_collaborators'),
      ('cloud_episodes'),
      ('cloud_pages'),
      ('cloud_assets'),
      ('cloud_canvas_snapshots'),
      ('cloud_project_versions'),
      ('cloud_generation_jobs')
      ,('cloud_ai_plans')
      ,('cloud_ai_entitlements')
      ,('cloud_ai_provider_prices')
      ,('cloud_ai_usage_periods')
      ,('cloud_ai_daily_costs')
      ,('cloud_ai_settings')
      ,('cloud_ai_rate_limits')
      ,('cloud_ai_cost_ledger')
    ) as required_tables(table_name)
    where not exists (
      select 1 from pg_class
      where oid = format('public.%I', required_tables.table_name)::regclass
        and relrowsecurity
    )
  ) then
    raise exception 'RLS is not enabled on every protected table';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'works_creator_delete'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'digital_products_creator_delete'
  ) then
    raise exception 'sales package Storage delete policies are missing';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'works' and public = true
  ) or not exists (
    select 1 from storage.buckets
    where id = 'digital-products' and public = false
  ) then
    raise exception 'required Storage buckets are missing or have invalid visibility';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'cloud-assets' and public = false and file_size_limit = 20971520
  ) then
    raise exception 'private Cloud Asset bucket is missing or invalid';
  end if;

  if exists (
    select 1 from pg_index
    where not indisvalid
      and indrelid in (
        'public.works'::regclass,
        'public.desktop_device_authorizations'::regclass,
        'public.desktop_device_rate_limits'::regclass
      )
  ) then
    raise exception 'an invalid MANGAI Hub index exists';
  end if;

  if exists (
    select 1 from public.desktop_device_authorizations
    where status = 'approved'
      and (profile_id is null or approved_at is null or token_expires_at is null)
  ) then
    raise exception 'approved Desktop authorization data is inconsistent';
  end if;
end $$;

select
  (select count(*) from public.works) as works,
  (select count(*) from public.digital_products) as digital_products,
  (select count(*) from public.desktop_device_authorizations) as device_authorizations;

rollback;
