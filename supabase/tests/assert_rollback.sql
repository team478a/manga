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
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='buyer_profile_id')
     or exists(select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_buyer_read')
     or to_regprocedure('public.record_order_download(uuid,uuid)') is not null then
    raise exception 'Buyer purchase library remains after rollback';
  end if;
  if to_regprocedure('public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text)') is not null then
    raise exception 'Cloud Marketplace draft function remains after rollback';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'content_class'
  ) or to_regclass('public.works_general_public_idx') is not null then
    raise exception 'content class boundary remains after rollback';
  end if;
  if to_regclass('public.desktop_device_authorizations') is not null
     or to_regclass('public.desktop_device_rate_limits') is not null then
    raise exception 'Desktop device tables remain after rollback';
  end if;
  if to_regclass('public.cloud_ai_plans') is not null
     or to_regclass('public.cloud_ai_cost_ledger') is not null
     or to_regprocedure('public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)') is not null then
    raise exception 'Cloud AI billing objects remain after rollback';
  end if;
  if to_regclass('public.stripe_webhook_events') is not null
     or to_regprocedure('public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text)') is not null then
    raise exception 'Stripe Cloud entitlement objects remain after rollback';
  end if;
  if to_regclass('public.cloud_projects') is not null
     or to_regclass('public.cloud_assets') is not null
     or to_regprocedure('public.save_cloud_page_snapshot(uuid,bigint,jsonb)') is not null
     or to_regprocedure('public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer)') is not null
     or to_regprocedure('public.add_cloud_episode(uuid,text)') is not null
     or to_regprocedure('public.add_cloud_page(uuid)') is not null
     or to_regprocedure('public.move_cloud_episode(uuid,integer)') is not null
     or to_regprocedure('public.move_cloud_page(uuid,integer)') is not null
     or to_regprocedure('public.soft_delete_cloud_episode(uuid)') is not null
     or to_regprocedure('public.soft_delete_cloud_page(uuid)') is not null
     or to_regprocedure('public.set_cloud_project_cover(uuid,uuid)') is not null
     or to_regclass('public.cloud_generation_jobs') is not null
     or to_regprocedure('public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)') is not null
     or to_regprocedure('public.claim_cloud_generation_job(text,integer)') is not null
     or exists (select 1 from storage.buckets where id = 'cloud-assets') then
    raise exception 'Cloud Creator Phase 1 objects remain after rollback';
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
