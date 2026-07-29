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
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'works_creator_update'
      and qual like '%owner_id%uid%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'digital_products_creator_update'
      and qual like '%owner_id%uid%'
  ) then
    raise exception 'Marketplace storage owner policies are missing';
  end if;
  if to_regclass('public.cloud_projects') is null
     or to_regclass('public.cloud_pages') is null
     or to_regclass('public.cloud_canvas_snapshots') is null
     or to_regclass('public.cloud_generation_jobs') is null
     or to_regclass('public.cloud_generation_storage_cleanup') is null then
    raise exception 'Cloud Creator Phase 1 schema is missing';
  end if;
  if to_regclass('public.cloud_ai_plans') is null
     or to_regclass('public.cloud_ai_entitlements') is null
     or to_regclass('public.cloud_ai_cost_ledger') is null
     or to_regclass('public.cloud_ai_rate_limits') is null then
    raise exception 'Cloud AI billing schema is missing';
  end if;
  if to_regclass('public.stripe_webhook_events') is null
     or to_regprocedure('public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text)') is null then
    raise exception 'Stripe Cloud entitlement schema is missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='buyer_profile_id')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_buyer_read')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_public_pending_insert' and with_check like '%buyer_profile_id%current_profile_id%')
     or to_regprocedure('public.record_order_download(uuid,uuid)') is null then
    raise exception 'Buyer purchase library schema is missing';
  end if;
  if to_regprocedure('public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text)') is null then
    raise exception 'Cloud Marketplace draft function is missing';
  end if;
  if to_regclass('public.cloud_ai_admin_audit_logs') is null then
    raise exception 'Cloud AI admin audit table is missing';
  end if;
  if to_regclass('public.cloud_ai_notifications') is null
     or to_regprocedure('public.refresh_cloud_ai_notifications()') is null then
    raise exception 'Cloud AI notification objects are missing';
  end if;
  if to_regprocedure('public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer)') is null
     or to_regprocedure('public.add_cloud_episode(uuid,text)') is null
     or to_regprocedure('public.add_cloud_page(uuid)') is null
     or to_regprocedure('public.move_cloud_episode(uuid,integer)') is null
     or to_regprocedure('public.move_cloud_page(uuid,integer)') is null
     or to_regprocedure('public.soft_delete_cloud_episode(uuid)') is null
     or to_regprocedure('public.soft_delete_cloud_page(uuid)') is null
     or to_regprocedure('public.set_cloud_project_cover(uuid,uuid)') is null
     or to_regprocedure('public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)') is null
     or to_regprocedure('public.claim_cloud_generation_job(text,integer)') is null
     or to_regprocedure('public.extend_cloud_generation_job_lease(uuid,uuid,integer)') is null
     or to_regprocedure('public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean)') is null
     or to_regprocedure('public.complete_cloud_generation_image_job(uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint)') is null
     or to_regprocedure('public.record_cloud_generation_storage_cleanup(uuid,text,text,text,text)') is null
     or to_regprocedure('public.queue_orphan_cloud_generation_assets()') is null then
    raise exception 'Cloud Creator structure functions are missing';
  end if;
  if to_regprocedure('public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.get_my_cloud_ai_quota()') is null
     or has_function_privilege('authenticated','public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)','execute')
     or not has_function_privilege('authenticated','public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)','execute') then
    raise exception 'Cloud AI quota functions or privileges are invalid';
  end if;
  if has_function_privilege('authenticated', 'public.claim_cloud_generation_job(text,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.extend_cloud_generation_job_lease(uuid,uuid,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.extend_cloud_generation_job_lease(uuid,uuid,integer)', 'execute') then
    raise exception 'authenticated users must not claim Cloud AI jobs';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'cloud-assets' and public = false and file_size_limit = 20971520
  ) then
    raise exception 'private Cloud Asset bucket is missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_research_ai_settings') is null
     or to_regclass('public.cloud_research_ai_audit_logs') is null
     or to_regprocedure(
       'public.set_cloud_research_ai_provider(uuid,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.get_cloud_research_ai_runtime_config()'
     ) is null then
    raise exception 'Current schema Cloud research AI Provider objects missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_adult_feature_grants') is null
     or to_regclass('public.cloud_adult_planning_briefs') is null then
    raise exception 'Current schema Cloud adult planning tables missing';
  end if;
  if to_regprocedure('public.can_use_cloud_adult_feature(text)') is null
     or to_regprocedure(
       'public.set_cloud_adult_feature_grant(uuid,uuid,text,text,text,timestamp with time zone,text)'
     ) is null then
    raise exception 'Current schema Cloud adult planning functions missing';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cloud_adult_planning_briefs'
      and policyname = 'cloud_adult_planning_owner_insert'
      and with_check like '%can_use_cloud_adult_feature%'
  ) then
    raise exception 'Current schema Cloud adult planning RLS missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_adult_research_settings') is null
     or to_regclass('public.cloud_adult_research_entitlements') is null
     or to_regclass('public.cloud_adult_research_consents') is null
     or to_regclass('public.cloud_adult_research_audit_logs') is null then
    raise exception 'Cloud adult research access tables missing';
  end if;
  if to_regprocedure('public.can_use_cloud_adult_research()') is null
     or to_regprocedure(
       'public.set_cloud_adult_research_enabled(uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.set_cloud_adult_research_entitlement(uuid,uuid,text,text,timestamp with time zone,text)'
     ) is null then
    raise exception 'Cloud adult research access functions missing';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cloud_market_research_reports'
      and policyname = 'cloud_market_research_owner_insert'
      and with_check like '%can_use_cloud_adult_research%'
  ) then
    raise exception 'Cloud adult research report RLS missing';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cloud_market_research_reports'::regclass
      and conname = 'cloud_market_research_reports_engine_version_check'
      and pg_get_constraintdef(oid) like '%research-rules-v2%'
  ) then
    raise exception 'Current schema Cloud research v2 engine constraint missing';
  end if;
end $$;
