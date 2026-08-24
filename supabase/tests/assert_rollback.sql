\set ON_ERROR_STOP on

do $$begin if to_regclass('public.cloud_character_state_assignments')is not null or to_regprocedure('public.save_cloud_character_state_assignment(uuid,uuid,uuid,integer,integer,text,text,text,text,integer)')is not null then raise exception 'Cloud character state assignment objects remain after rollback';end if;end$$;

do $$begin
  if to_regclass('public.cloud_project_generation_readiness_policies') is not null or to_regprocedure('public.save_cloud_project_generation_readiness_policy(uuid,text)') is not null then raise exception 'Cloud generation reference readiness objects remain after rollback';end if;
end$$;

do $$begin
  if to_regclass('public.cloud_character_reference_bindings') is not null or to_regprocedure('public.save_cloud_character_reference_binding(uuid,uuid,uuid,uuid,text,text,integer,text)') is not null then raise exception 'Cloud character reference binding objects remain after rollback';end if;
end$$;

do $$
begin
  if to_regprocedure('public.enforce_cloud_monitor_quality_review_panel_slot()') is not null then
    raise exception 'Cloud monitor review panel function remains after rollback';
  end if;
  if to_regclass('public.cloud_chapters') is not null
     or to_regclass('public.cloud_scenes') is not null
     or to_regprocedure('public.move_cloud_page_before(uuid,uuid)') is not null then
    raise exception 'Long-form manga structure rollback failed';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_generation_batches') is not null
     or to_regclass('public.cloud_generation_batch_jobs') is not null
     or to_regclass('public.cloud_page_edit_locks') is not null
     or to_regprocedure('public.create_cloud_generation_batch(uuid,uuid[],text)') is not null
     or to_regprocedure('public.replace_cloud_generation_batch_job(uuid,uuid)') is not null
     or to_regprocedure('public.acquire_cloud_page_edit_lock(uuid,uuid,integer)') is not null then
    raise exception 'Cloud batch production rollback failed';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_general_monitor_email_settings') is not null
     or to_regclass('public.cloud_general_monitor_email_audit_logs') is not null
     or to_regprocedure(
       'public.set_cloud_general_monitor_email_provider(uuid,text,text,text,boolean)'
     ) is not null
     or to_regprocedure(
       'public.get_cloud_general_monitor_email_runtime_config()'
     ) is not null then
    raise exception 'General monitor email Provider objects remain after rollback';
  end if;
  if to_regprocedure('public.complete_cloud_general_monitor_onboarding()') is not null
     or to_regprocedure('public.review_cloud_general_monitor_feedback(uuid,uuid,text,text)') is not null then
    raise exception 'General monitor operations functions remain after rollback';
  end if;
  if to_regclass('public.cloud_story_storyboard_projects') is not null
     or to_regprocedure(
       'public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb)'
     ) is not null
     or to_regprocedure(
       'public.materialize_cloud_storyboard_project(uuid)'
     ) is not null then
    raise exception 'Cloud storyboard Canvas materialization objects remain after rollback';
  end if;
  if to_regclass('public.cloud_story_storyboard_adoptions') is not null
     or to_regclass('public.cloud_story_storyboard_versions') is not null then
    raise exception 'Cloud story storyboard tables remain after rollback';
  end if;
  if to_regclass('public.cloud_story_scenario_adoptions') is not null
     or to_regclass('public.cloud_story_scenario_versions') is not null then
    raise exception 'Cloud story scenario tables remain after rollback';
  end if;
  if to_regclass('public.cloud_adult_feature_grants') is not null
     or to_regclass('public.cloud_adult_planning_briefs') is not null
     or to_regprocedure('public.can_use_cloud_adult_feature(text)') is not null
     or to_regprocedure(
       'public.set_cloud_adult_feature_grant(uuid,uuid,text,text,text,timestamp with time zone,text)'
     ) is not null then
    raise exception 'Cloud adult planning objects remain after rollback';
  end if;
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
  if to_regclass('public.cloud_ai_admin_audit_logs') is not null then
    raise exception 'Cloud AI admin audit table remains after rollback';
  end if;
  if to_regclass('public.cloud_ai_notifications') is not null
     or to_regprocedure('public.refresh_cloud_ai_notifications()') is not null then
    raise exception 'Cloud AI notification objects remain after rollback';
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
     or to_regprocedure('public.extend_cloud_generation_job_lease(uuid,uuid,integer)') is not null
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

do $$ begin
  if to_regclass('public.cloud_generation_run_checkpoints') is not null
     or to_regprocedure('public.record_cloud_generation_run_checkpoint(uuid)') is not null then
    raise exception 'Cloud generation run checkpoint objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_visual_reference_assets') is not null
    or to_regclass('public.cloud_panel_subject_assignments') is not null
    or to_regprocedure('public.save_cloud_visual_reference(uuid,text,uuid,uuid,text)') is not null
    or to_regprocedure('public.save_cloud_panel_subject_assignment(uuid,uuid,uuid,text,uuid)') is not null then
    raise exception 'Cloud visual reference objects remain after rollback';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_general_image_provider_settings') is not null
     or to_regclass('public.cloud_general_image_provider_audit_logs') is not null
     or to_regprocedure(
       'public.set_cloud_general_image_provider(uuid,text,text,boolean)'
     ) is not null
     or to_regprocedure(
       'public.get_cloud_general_image_runtime_config()'
     ) is not null then
    raise exception 'Cloud general image Provider objects remain after rollback';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_research_ai_settings') is not null
     or to_regclass('public.cloud_research_ai_audit_logs') is not null
     or to_regprocedure(
       'public.set_cloud_research_ai_provider(uuid,text,text,boolean)'
     ) is not null
     or to_regprocedure(
       'public.get_cloud_research_ai_runtime_config()'
     ) is not null then
    raise exception 'Cloud research AI Provider objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_export_jobs') is not null
     or to_regclass('public.cloud_export_segments') is not null
     or to_regprocedure('public.create_cloud_export_job(uuid,text)') is not null
     or exists(select 1 from storage.buckets where id='cloud-exports') then
    raise exception 'Durable export objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_page_thumbnails') is not null
     or to_regclass('public.cloud_storage_cleanup') is not null
     or to_regprocedure('public.claim_cloud_page_thumbnail(text,integer)') is not null
     or exists(select 1 from storage.buckets where id='cloud-cache') then
    raise exception 'Cloud storage lifecycle objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_resource_budgets') is not null
     or to_regprocedure('public.save_cloud_project_resource_budget(uuid,integer,bigint,bigint,integer,boolean)') is not null
     or to_regprocedure('public.get_cloud_project_resource_usage(uuid)') is not null then
    raise exception 'Cloud project resource budget objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_backup_blobs') is not null
     or to_regclass('public.cloud_project_checkpoints') is not null
     or to_regclass('public.cloud_project_checkpoint_pages') is not null
     or to_regprocedure('public.create_cloud_project_checkpoint(uuid,text,text)') is not null then
    raise exception 'Cloud project checkpoint objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_checkpoint_restores') is not null
     or to_regprocedure('public.restore_cloud_project_checkpoint(uuid,uuid)') is not null then
    raise exception 'Cloud project checkpoint restore objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_manga_quality_logs') is not null
     or to_regprocedure('public.record_cloud_manga_quality_event(uuid,text,text)') is not null then
    raise exception 'Cloud manga quality Q0 objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_product_updates') is not null
     or to_regclass('public.cloud_monitor_issue_tasks') is not null
     or to_regprocedure('public.claim_cloud_monitor_issue_task(text)') is not null
     or to_regprocedure('public.complete_cloud_monitor_issue_task(uuid,text,text,text,text,text,text)') is not null
     or exists (
       select 1 from information_schema.columns
       where table_schema='public'
         and table_name='cloud_general_monitor_feedback'
         and column_name='request_type'
     ) then
    raise exception 'Cloud monitor operations hub objects remain after rollback';
  end if;
end $$;

do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='client_context')
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='attachment_path')
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='public_status')
     or to_regprocedure('public.limit_cloud_monitor_feedback_rate()') is not null
     or to_regprocedure('public.notify_cloud_monitor_feedback_received()') is not null
     or to_regprocedure('public.sync_cloud_monitor_issue_public_status()') is not null
     or exists(select 1 from storage.buckets where id='monitor-feedback') then
    raise exception 'Cloud monitor operations Phase 2 objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_generation_batch_targets') is not null
     or to_regprocedure('public.create_cloud_generation_batch_targets(uuid,uuid[],text,jsonb)') is not null
     or to_regprocedure('public.dispatch_next_cloud_generation_batch_target()') is not null then
    raise exception 'Cloud generation durable batch target objects remain after rollback';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_work_publications') is not null
     or to_regclass('public.cloud_work_publication_pages') is not null
     or to_regprocedure('public.sync_cloud_marketplace_release_draft(uuid,uuid,text,text,text,jsonb,integer,text)') is not null
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='works' and column_name='current_publication_id') then
    raise exception 'Cloud work publication objects remain after rollback';
  end if;
end $$;
