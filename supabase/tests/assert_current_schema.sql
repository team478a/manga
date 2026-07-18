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
     or to_regclass('public.cloud_canvas_snapshots') is null
     or to_regclass('public.cloud_generation_jobs') is null then
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
     or to_regprocedure('public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean)') is null then
    raise exception 'Cloud Creator structure functions are missing';
  end if;
  if to_regprocedure('public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.get_my_cloud_ai_quota()') is null
     or has_function_privilege('authenticated','public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)','execute')
     or not has_function_privilege('authenticated','public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)','execute') then
    raise exception 'Cloud AI quota functions or privileges are invalid';
  end if;
  if has_function_privilege('authenticated', 'public.claim_cloud_generation_job(text,integer)', 'execute') then
    raise exception 'authenticated users must not claim Cloud AI jobs';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'cloud-assets' and public = false and file_size_limit = 20971520
  ) then
    raise exception 'private Cloud Asset bucket is missing';
  end if;
end $$;
