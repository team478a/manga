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

do $$ begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='cloud_monitor_quality_review_batches'
      and column_name='target_reviewer_count'
      and column_default='5'
  )
     or to_regprocedure('public.enforce_cloud_monitor_quality_review_panel_slot()') is null
     or not exists(
       select 1 from pg_trigger
       where tgrelid='public.cloud_monitor_quality_review_assignments'::regclass
         and tgname='cloud_monitor_quality_review_assignments_panel_slot'
         and not tgisinternal
     ) then
    raise exception 'Current schema Cloud monitor multi-reviewer panel missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_chapters') is null
     or to_regclass('public.cloud_scenes') is null
     or to_regprocedure('public.add_cloud_chapter(uuid,text)') is null
     or to_regprocedure('public.add_cloud_episode_to_chapter(uuid,text)') is null
     or to_regprocedure('public.add_cloud_scene(uuid,text,text)') is null
     or to_regprocedure('public.add_cloud_page_to_scene(uuid)') is null
     or to_regprocedure('public.move_cloud_page_before(uuid,uuid)') is null then
    raise exception 'Current schema long-form manga structure missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_episodes' and column_name='chapter_id')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_pages' and column_name='scene_id') then
    raise exception 'Current schema long-form links missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_generation_batches') is null
     or to_regclass('public.cloud_generation_batch_jobs') is null
     or to_regclass('public.cloud_page_edit_locks') is null
     or to_regprocedure('public.create_cloud_generation_batch(uuid,uuid[],text)') is null
     or to_regprocedure('public.attach_cloud_generation_batch_job(uuid,uuid)') is null
     or to_regprocedure('public.replace_cloud_generation_batch_job(uuid,uuid)') is null
     or to_regprocedure('public.set_cloud_generation_batch_state(uuid,text)') is null
     or to_regprocedure('public.acquire_cloud_page_edit_lock(uuid,uuid,integer)') is null
     or to_regprocedure('public.release_cloud_page_edit_lock(uuid,uuid)') is null then
    raise exception 'Current schema batch production objects missing';
  end if;
  if not coalesce((select relrowsecurity from pg_class where oid='public.cloud_generation_batches'::regclass),false)
     or not coalesce((select relrowsecurity from pg_class where oid='public.cloud_page_edit_locks'::regclass),false)
     or not has_function_privilege('authenticated','public.create_cloud_generation_batch(uuid,uuid[],text)','execute') then
    raise exception 'Current schema batch production access controls invalid';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_visual_reference_assets') is null
    or to_regclass('public.cloud_panel_subject_assignments') is null
    or not coalesce((select relrowsecurity from pg_class where oid='public.cloud_visual_reference_assets'::regclass),false)
    or not coalesce((select relrowsecurity from pg_class where oid='public.cloud_panel_subject_assignments'::regclass),false) then
    raise exception 'Current schema Cloud visual reference objects missing or RLS disabled';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_general_image_provider_settings') is null
     or to_regclass('public.cloud_general_image_provider_audit_logs') is null
     or to_regprocedure(
       'public.set_cloud_general_image_provider(uuid,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.get_cloud_general_image_runtime_config()'
     ) is null then
    raise exception 'Cloud general image Provider objects missing';
  end if;
  if not exists (
    select 1 from public.cloud_ai_provider_prices
    where provider_id = 'black-forest-labs'
      and model_id = 'flux-2-pro'
      and pricing_version = 'bfl-flux2-2026-03'
      and active
  ) then
    raise exception 'Cloud general image Provider prices missing';
  end if;
  if not exists (
    select 1 from public.cloud_ai_provider_prices
    where provider_id = 'black-forest-labs'
      and model_id = 'flux-pro-1.0-fill'
      and job_type = 'background'
      and pricing_version = 'bfl-flux1-fill-2026-08'
      and credits = 3
      and max_cost_micros = 50000
      and active
  ) then
    raise exception 'Cloud panel inpainting price missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_general_monitor_email_settings') is null
     or to_regclass('public.cloud_general_monitor_email_audit_logs') is null
     or to_regprocedure(
       'public.set_cloud_general_monitor_email_provider(uuid,text,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.get_cloud_general_monitor_email_runtime_config()'
     ) is null
     or to_regprocedure(
       'public.set_cloud_general_monitor_email_template(uuid,text,text)'
     ) is null then
    raise exception 'Current schema General monitor email Provider missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='cloud_general_monitor_email_settings'
      and column_name in ('subject_template','body_template')
    group by table_schema,table_name
    having count(*)=2
  ) then
    raise exception 'Current schema General monitor email templates missing';
  end if;
  if has_function_privilege(
       'authenticated',
       'public.get_cloud_general_monitor_email_runtime_config()',
       'execute'
     ) then
    raise exception 'Current schema General monitor email runtime config exposed';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_enrollments' and column_name='onboarding_completed_at')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='review_status')
     or to_regprocedure('public.complete_cloud_general_monitor_onboarding()') is null
     or to_regprocedure('public.review_cloud_general_monitor_feedback(uuid,uuid,text,text)') is null then
    raise exception 'Current schema general monitor operations objects missing';
  end if;
  if not has_function_privilege('authenticated','public.complete_cloud_general_monitor_onboarding()','execute')
     or has_function_privilege('authenticated','public.review_cloud_general_monitor_feedback(uuid,uuid,text,text)','execute') then
    raise exception 'General monitor operations privileges are invalid';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_story_storyboard_projects') is null
     or to_regprocedure(
       'public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb)'
     ) is null
     or to_regprocedure(
       'public.materialize_cloud_storyboard_project(uuid)'
     ) is null then
    raise exception 'Current schema storyboard Canvas materialization objects missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='cloud_story_storyboard_projects'
      and policyname='cloud_story_storyboard_projects_owner_read'
  ) then
    raise exception 'Current schema storyboard Canvas owner RLS missing';
  end if;
  if has_function_privilege(
       'authenticated',
       'public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb)',
       'execute'
     ) then
    raise exception 'Canvas builder must not be directly executable by authenticated users';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.materialize_cloud_storyboard_project(uuid)',
       'execute'
     ) then
    raise exception 'Canvas materialization RPC privilege missing';
  end if;
end $$;

do $$
declare
  v_page_id uuid := gen_random_uuid();
  v_canvas jsonb;
begin
  select public.build_cloud_storyboard_canvas(
    v_page_id,
    1600,
    2400,
    jsonb_build_object(
      'pageNumber', 1,
      'panels', jsonb_build_array(
        jsonb_build_object(
          'panelNumber', 1,
          'description', '導入',
          'dialogue', jsonb_build_array(
            jsonb_build_object(
              'speaker', '主人公',
              'text', '始めよう',
              'type', 'speech'
            )
          )
        )
      )
    )
  ) into v_canvas;
  if v_canvas->>'schemaVersion' <> '1'
     or v_canvas->>'pageId' <> v_page_id::text
     or jsonb_array_length(v_canvas->'panels') <> 1
     or jsonb_array_length(v_canvas->'balloons') <> 1
     or jsonb_array_length(v_canvas->'textObjects') <> 1
     or jsonb_typeof(v_canvas->'panelLayers') <> 'array' then
    raise exception 'Storyboard Canvas builder returned an invalid Canvas v1 document';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_story_storyboard_versions') is null
     or to_regclass('public.cloud_story_storyboard_adoptions') is null then
    raise exception 'Current schema Cloud storyboard tables missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_story_scenario_versions') is null
     or to_regclass('public.cloud_story_scenario_adoptions') is null then
    raise exception 'Current schema Cloud scenario tables missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='cloud_story_scenario_versions'
      and policyname='cloud_story_scenario_versions_owner_insert'
  ) then
    raise exception 'Current schema Cloud scenario RLS missing';
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

do $$ begin
  if to_regclass('public.cloud_export_jobs') is null
     or to_regclass('public.cloud_export_segments') is null
     or to_regprocedure('public.create_cloud_export_job(uuid,text)') is null
     or to_regprocedure('public.claim_cloud_export_job(text,integer)') is null
     or not exists(select 1 from storage.buckets where id='cloud-exports') then
    raise exception 'Current schema durable export objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_page_thumbnails') is null
     or to_regclass('public.cloud_storage_cleanup') is null
     or to_regprocedure('public.claim_cloud_page_thumbnail(text,integer)') is null
     or to_regprocedure('public.claim_cloud_storage_cleanup(text,integer)') is null
     or not exists(select 1 from storage.buckets where id='cloud-cache' and public=false) then
    raise exception 'Current schema storage lifecycle objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_continuity_facts') is null
     or to_regclass('public.cloud_plot_threads') is null
     or to_regprocedure('public.save_cloud_continuity_fact(uuid,uuid,text,text,text,text,integer,integer,integer,text)') is null
     or to_regprocedure('public.save_cloud_plot_thread(uuid,uuid,text,integer,integer,integer,text,text)') is null then
    raise exception 'Current schema narrative continuity objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_resource_budgets') is null
     or to_regprocedure('public.save_cloud_project_resource_budget(uuid,integer,bigint,bigint,integer,boolean)') is null
     or to_regprocedure('public.get_cloud_project_resource_usage(uuid)') is null then
    raise exception 'Current schema project resource budget objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_backup_blobs') is null
     or to_regclass('public.cloud_project_checkpoints') is null
     or to_regclass('public.cloud_project_checkpoint_pages') is null
     or to_regprocedure('public.create_cloud_project_checkpoint(uuid,text,text)') is null
     or position(
       'extensions.digest' in pg_get_functiondef('public.create_cloud_project_checkpoint(uuid,text,text)'::regprocedure)
     )=0 then
    raise exception 'Current schema project checkpoint objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_checkpoint_restores') is null
     or to_regprocedure('public.restore_cloud_project_checkpoint(uuid,uuid)') is null then
    raise exception 'Current schema project checkpoint restore objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_product_updates') is null
     or to_regclass('public.cloud_monitor_issue_tasks') is null
     or to_regprocedure('public.claim_cloud_monitor_issue_task(text)') is null
     or to_regprocedure('public.complete_cloud_monitor_issue_task(uuid,text,text,text,text,text,text)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema='public'
         and table_name='cloud_general_monitor_feedback'
         and column_name='request_type'
     )
     or not exists (
       select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname='cloud_product_updates' and c.relrowsecurity
     )
     or not exists (
       select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname='cloud_monitor_issue_tasks' and c.relrowsecurity
     ) then
    raise exception 'Current schema monitor operations hub objects missing';
  end if;
end $$;

do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='client_context')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='attachment_path')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='public_status')
     or to_regprocedure('public.limit_cloud_monitor_feedback_rate()') is null
     or to_regprocedure('public.notify_cloud_monitor_feedback_received()') is null
     or to_regprocedure('public.sync_cloud_monitor_issue_public_status()') is null
     or not exists(select 1 from storage.buckets where id='monitor-feedback' and public=false and file_size_limit=5242880) then
    raise exception 'Current schema monitor operations Phase 2 objects missing';
  end if;
end $$;
