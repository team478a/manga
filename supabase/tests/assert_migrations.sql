\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'source_project_id'
  ) then
    raise exception 'source_project_id migration missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'content_class'
  ) or not exists (
    select 1 from pg_constraint
    where conname = 'works_content_class_check'
      and conrelid = 'public.works'::regclass
  ) then
    raise exception 'content class boundary migration missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'works'
      and policyname = 'works_creator_insert'
      and with_check like '%content_class%general%'
  ) then
    raise exception 'general-only works insert policy missing';
  end if;
  if to_regclass('public.desktop_device_authorizations') is null then
    raise exception 'desktop_device_authorizations migration missing';
  end if;
  if to_regclass('public.desktop_device_rate_limits') is null then
    raise exception 'desktop_device_rate_limits migration missing';
  end if;
  if to_regclass('public.cloud_projects') is null
     or to_regclass('public.cloud_episodes') is null
     or to_regclass('public.cloud_pages') is null
     or to_regclass('public.cloud_assets') is null
     or to_regclass('public.cloud_canvas_snapshots') is null
     or to_regclass('public.cloud_project_versions') is null then
    raise exception 'Cloud Creator Phase 1 tables are missing';
  end if;
  if to_regprocedure('public.save_cloud_page_snapshot(uuid,bigint,jsonb)') is null
     or to_regprocedure('public.import_cloud_project(jsonb)') is null
     or to_regprocedure('public.restore_cloud_project(uuid)') is null
     or to_regprocedure('public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer)') is null
     or to_regprocedure('public.add_cloud_episode(uuid,text)') is null
     or to_regprocedure('public.add_cloud_page(uuid)') is null
     or to_regprocedure('public.move_cloud_episode(uuid,integer)') is null
     or to_regprocedure('public.move_cloud_page(uuid,integer)') is null
     or to_regprocedure('public.soft_delete_cloud_episode(uuid)') is null
     or to_regprocedure('public.soft_delete_cloud_page(uuid)') is null
     or to_regprocedure('public.set_cloud_project_cover(uuid,uuid)') is null
     or to_regprocedure('public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)') is null
     or to_regprocedure('public.cancel_cloud_generation_job(uuid)') is null
     or to_regprocedure('public.claim_cloud_generation_job(text,integer)') is null
     or to_regprocedure('public.extend_cloud_generation_job_lease(uuid,uuid,integer)') is null
     or to_regprocedure('public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean)') is null then
    raise exception 'Cloud Creator functions are missing';
  end if;
  if to_regclass('public.cloud_generation_jobs') is null then
    raise exception 'Cloud AI queue table is missing';
  end if;
  if to_regclass('public.cloud_generation_storage_cleanup') is null
     or to_regprocedure('public.complete_cloud_generation_image_job(uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint)') is null
     or to_regprocedure('public.record_cloud_generation_storage_cleanup(uuid,text,text,text,text)') is null
     or to_regprocedure('public.queue_orphan_cloud_generation_assets()') is null
     or not exists(
       select 1 from pg_indexes
       where schemaname='public'
         and indexname='cloud_assets_source_generation_job_idx'
     ) then
    raise exception 'Cloud AI completion compensation objects are missing';
  end if;
  if to_regclass('public.cloud_ai_plans') is null
     or to_regclass('public.cloud_ai_entitlements') is null
     or to_regclass('public.cloud_ai_provider_prices') is null
     or to_regclass('public.cloud_ai_usage_periods') is null
     or to_regclass('public.cloud_ai_cost_ledger') is null
     or to_regclass('public.cloud_ai_rate_limits') is null then
    raise exception 'Cloud AI billing tables are missing';
  end if;
  if to_regclass('public.stripe_webhook_events') is null
     or to_regprocedure('public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text)') is null then
    raise exception 'Stripe Cloud entitlement objects are missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='buyer_profile_id')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_buyer_read')
     or not exists(select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_public_pending_insert' and with_check like '%buyer_profile_id%current_profile_id%')
     or to_regprocedure('public.record_order_download(uuid,uuid)') is null then
    raise exception 'Buyer purchase library schema is missing';
  end if;
  if to_regprocedure('public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text)') is null
     or has_function_privilege('anon','public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text)','execute')
     or not has_function_privilege('authenticated','public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text)','execute') then
    raise exception 'Cloud Marketplace draft function is missing or has invalid privileges';
  end if;
  if to_regclass('public.cloud_ai_admin_audit_logs') is null
     or not has_table_privilege('service_role','public.cloud_ai_admin_audit_logs','insert')
     or has_table_privilege('authenticated','public.cloud_ai_admin_audit_logs','select') then
    raise exception 'Cloud AI admin audit boundary is invalid';
  end if;
  if to_regclass('public.cloud_ai_notifications') is null
     or to_regprocedure('public.refresh_cloud_ai_notifications()') is null
     or has_function_privilege('authenticated','public.refresh_cloud_ai_notifications()','execute')
     or not has_function_privilege('service_role','public.refresh_cloud_ai_notifications()','execute') then
    raise exception 'Cloud AI notification boundary is invalid';
  end if;
  if has_column_privilege('authenticated','public.cloud_ai_notifications','title','update')
     or not has_column_privilege('authenticated','public.cloud_ai_notifications','read_at','update') then
    raise exception 'Cloud AI notification update columns are invalid';
  end if;
  if to_regprocedure('public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)') is null
     or to_regprocedure('public.consume_cloud_ai_rate_limit(text,text,integer,integer)') is null
     or to_regprocedure('public.get_my_cloud_ai_quota()') is null then
    raise exception 'Cloud AI billing functions are missing';
  end if;
  if exists (
    select 1 from storage.buckets where id = 'cloud-assets' and public
  ) or not exists (
    select 1 from storage.buckets where id = 'cloud-assets' and not public
      and file_size_limit = 20971520
  ) then
    raise exception 'Cloud Asset bucket must be private and limited to 20MB';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'cloud_projects' and policyname = 'cloud_projects_read'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'storage'
      and tablename = 'objects' and policyname = 'cloud_assets_storage_insert'
  ) then
    raise exception 'Cloud Creator RLS policies are missing';
  end if;
  if has_function_privilege('anon', 'public.save_cloud_page_snapshot(uuid,bigint,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_cloud_page_snapshot(uuid,bigint,jsonb)', 'execute') then
    raise exception 'Cloud snapshot function privileges are invalid';
  end if;
  if has_function_privilege('authenticated', 'public.claim_cloud_generation_job(text,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.claim_cloud_generation_job(text,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.extend_cloud_generation_job_lease(uuid,uuid,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.extend_cloud_generation_job_lease(uuid,uuid,integer)', 'execute') then
    raise exception 'Cloud worker function privileges are invalid';
  end if;
  if has_function_privilege(
       'authenticated',
       'public.complete_cloud_generation_image_job(uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint)',
       'execute'
     ) or not has_function_privilege(
       'service_role',
       'public.complete_cloud_generation_image_job(uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint)',
       'execute'
     ) then
    raise exception 'Cloud image completion function privileges are invalid';
  end if;
  if has_function_privilege(
       'authenticated','public.queue_orphan_cloud_generation_assets()','execute'
     ) or not has_function_privilege(
       'service_role','public.queue_orphan_cloud_generation_assets()','execute'
     ) then
    raise exception 'Cloud orphan cleanup function privileges are invalid';
  end if;
  if has_function_privilege('authenticated', 'public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint)', 'execute')
     or not has_function_privilege('authenticated', 'public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb)', 'execute') then
    raise exception 'Cloud quota enqueue privileges are invalid';
  end if;
  if has_function_privilege('authenticated', 'public.record_order_download(uuid,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.record_order_download(uuid,uuid)', 'execute') then
    raise exception 'Buyer download recorder privileges are invalid';
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
    raise exception 'sales package storage delete policies are missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'works_creator_upload'
      and with_check like '%foldername%uid%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'works_creator_update'
      and qual like '%owner_id%uid%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'digital_products_creator_upload'
      and with_check like '%foldername%uid%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'digital_products_creator_update'
      and qual like '%owner_id%uid%'
  ) then
    raise exception 'Marketplace storage ownership boundary is invalid';
  end if;
  if has_function_privilege('anon', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'anon must not execute rate limit function';
  end if;
  if not has_function_privilege('service_role', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'service_role must execute rate limit function';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_generation_batches') is null
     or to_regclass('public.cloud_generation_batch_jobs') is null
     or to_regclass('public.cloud_page_edit_locks') is null
     or to_regprocedure('public.create_cloud_generation_batch(uuid,uuid[],text)') is null
     or to_regprocedure('public.replace_cloud_generation_batch_job(uuid,uuid)') is null
     or to_regprocedure('public.acquire_cloud_page_edit_lock(uuid,uuid,integer)') is null then
    raise exception 'Cloud batch production migration objects missing';
  end if;
  if has_function_privilege('anon','public.create_cloud_generation_batch(uuid,uuid[],text)','execute')
     or not has_function_privilege('authenticated','public.release_cloud_page_edit_lock(uuid,uuid)','execute') then
    raise exception 'Cloud batch production function privileges invalid';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_visual_reference_assets') is null
    or to_regclass('public.cloud_panel_subject_assignments') is null
    or to_regprocedure('public.save_cloud_visual_reference(uuid,text,uuid,uuid,text)') is null
    or to_regprocedure('public.save_cloud_panel_subject_assignment(uuid,uuid,uuid,text,uuid)') is null then
    raise exception 'Cloud visual reference objects missing';
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
    raise exception 'Cloud general image Provider migration missing';
  end if;
  if not exists (
    select 1 from public.cloud_ai_provider_prices
    where provider_id = 'black-forest-labs'
      and model_id = 'flux-2-pro'
      and pricing_version = 'bfl-flux2-2026-03'
      and active
  ) then
    raise exception 'Cloud general image Provider price migration missing';
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
    raise exception 'Cloud panel inpainting price migration missing';
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
    raise exception 'General monitor email Provider objects missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='cloud_general_monitor_email_settings'
      and column_name in ('subject_template','body_template')
    group by table_schema,table_name
    having count(*)=2
  ) then
    raise exception 'General monitor email templates missing';
  end if;
  if has_function_privilege(
       'authenticated',
       'public.get_cloud_general_monitor_email_runtime_config()',
       'execute'
     ) then
    raise exception 'General monitor email runtime config exposed';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_general_monitor_enrollments') is null
    or to_regclass('public.cloud_general_monitor_ai_usage') is null
    or to_regclass('public.cloud_general_monitor_feedback') is null
    or to_regclass('public.cloud_general_monitor_audit_logs') is null
  then
    raise exception 'General monitor beta tables are missing';
  end if;
  if not exists (
    select 1 from pg_class
    where oid='public.cloud_general_monitor_enrollments'::regclass
      and relrowsecurity
  ) then
    raise exception 'General monitor enrollment RLS is disabled';
  end if;
  if to_regprocedure('public.consume_cloud_general_monitor_ai_request(uuid,text)') is null
    or to_regprocedure('public.activate_cloud_general_monitor(uuid,uuid,timestamp with time zone,integer,text,text)') is null
    or to_regprocedure('public.stop_cloud_general_monitor(uuid,uuid,text,text)') is null
    or to_regprocedure('public.record_cloud_general_monitor_invite_email_sent(uuid,uuid)') is null
  then
    raise exception 'General monitor beta RPCs are missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='cloud_general_monitor_enrollments'
      and column_name in ('invite_email_sent_at','invite_email_send_count')
    group by table_schema,table_name
    having count(*)=2
  ) then
    raise exception 'General monitor invite delivery tracking is missing';
  end if;
  if has_function_privilege(
       'authenticated',
       'public.record_cloud_general_monitor_invite_email_sent(uuid,uuid)',
       'execute'
     ) or not has_function_privilege(
       'service_role',
       'public.record_cloud_general_monitor_invite_email_sent(uuid,uuid)',
       'execute'
     ) then
    raise exception 'General monitor invite recorder privileges are invalid';
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
    raise exception 'Cloud research AI Provider objects missing';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cloud_market_research_reports'::regclass
      and conname = 'cloud_market_research_reports_engine_version_check'
      and pg_get_constraintdef(oid) like '%openai-web-research-v1%'
  ) then
    raise exception 'Cloud research AI engine constraint missing';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_adult_research_settings') is null
     or to_regclass('public.cloud_adult_research_entitlements') is null
     or to_regclass('public.cloud_adult_research_consents') is null
     or to_regclass('public.cloud_adult_research_audit_logs') is null then
    raise exception 'Cloud adult research migration tables missing';
  end if;
  if to_regprocedure('public.can_use_cloud_adult_research()') is null
     or to_regprocedure(
       'public.set_cloud_adult_research_enabled(uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.set_cloud_adult_research_entitlement(uuid,uuid,text,text,timestamp with time zone,text)'
     ) is null then
    raise exception 'Cloud adult research migration functions missing';
  end if;
end $$;

begin;
insert into auth.users(id,email) values
  ('22000000-0000-4000-8000-000000000001','adult-plan-owner@example.test'),
  ('22000000-0000-4000-8000-000000000002','adult-plan-other@example.test'),
  ('22000000-0000-4000-8000-000000000003','adult-plan-admin@example.test');
insert into public.profiles(id,user_id,role) values
  ('32000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','creator'),
  ('32000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','creator'),
  ('32000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000003','admin');
update public.cloud_adult_research_settings set enabled = true where singleton;
insert into public.cloud_adult_research_entitlements (
  profile_id,status,source,granted_by_profile_id
) values (
  '32000000-0000-4000-8000-000000000001','approved','admin_grant',
  '32000000-0000-4000-8000-000000000003'
);
insert into public.cloud_adult_research_consents (
  profile_id,age_confirmed_at,terms_version,terms_accepted_at
) values (
  '32000000-0000-4000-8000-000000000001',now(),'adult-research-v1',now()
);
insert into public.cloud_adult_feature_grants (
  profile_id,feature_key,status,source,granted_by_profile_id
) values (
  '32000000-0000-4000-8000-000000000001','adult_planning','approved',
  'admin_grant','32000000-0000-4000-8000-000000000003'
);
insert into public.cloud_market_research_reports (
  id,owner_profile_id,status,input,sources,result,engine_version,completed_at
) values (
  '82000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  'completed',
  '{"contentClass":"adult"}',
  '[{"url":"https://example.test/source"}]',
  '{"containsGeneratedMarketNumbers":false}',
  'research-rules-v2',
  now()
);

select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into public.cloud_adult_planning_briefs (
  owner_profile_id,research_report_id,status,working_title,concept,
  protagonist,protagonist_goal,central_conflict,reader_promise,tone,
  differentiation,ending_direction,notes
) values (
  '32000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'draft','Test','Concept','Hero','Goal','Conflict','Promise','Tone',
  'Difference','Ending',''
);
do $$
begin
  if (select count(*) from public.cloud_adult_planning_briefs) <> 1 then
    raise exception 'Adult planning owner could not read their brief';
  end if;
end $$;

select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-4000-8000-000000000002',
  true
);
do $$
begin
  if exists (select 1 from public.cloud_adult_planning_briefs) then
    raise exception 'Other user could read an adult planning brief';
  end if;
  begin
    insert into public.cloud_adult_planning_briefs (
      owner_profile_id,research_report_id,status,working_title,concept,
      protagonist,protagonist_goal,central_conflict,reader_promise,tone,
      differentiation,ending_direction,notes
    ) values (
      '32000000-0000-4000-8000-000000000002',
      '82000000-0000-4000-8000-000000000001',
      'draft','Blocked','Blocked','Blocked','Blocked','Blocked','Blocked',
      'Blocked','Blocked','Blocked',''
    );
    raise exception 'Other user inserted an adult planning brief';
  exception
    when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;

do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_enrollments' and column_name='onboarding_completed_at')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cloud_general_monitor_feedback' and column_name='review_status')
     or to_regprocedure('public.complete_cloud_general_monitor_onboarding()') is null
     or to_regprocedure('public.review_cloud_general_monitor_feedback(uuid,uuid,text,text)') is null then
    raise exception 'General monitor operations migration is incomplete';
  end if;
end $$;

do $$
begin
  if to_regclass('public.cloud_adult_feature_grants') is null
     or to_regclass('public.cloud_adult_planning_briefs') is null then
    raise exception 'Cloud adult planning tables missing';
  end if;
  if to_regprocedure('public.can_use_cloud_adult_feature(text)') is null
     or to_regprocedure(
       'public.set_cloud_adult_feature_grant(uuid,uuid,text,text,text,timestamp with time zone,text)'
     ) is null then
    raise exception 'Cloud adult planning functions missing';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cloud_adult_planning_briefs'
      and policyname = 'cloud_adult_planning_owner_insert'
      and with_check like '%can_use_cloud_adult_feature%'
  ) then
    raise exception 'Cloud adult planning RLS missing';
  end if;
end $$;

begin;
insert into auth.users(id,email) values
  ('20000000-0000-4000-8000-000000000001','phase1-owner@example.test'),
  ('20000000-0000-4000-8000-000000000002','phase1-other@example.test');
insert into public.profiles(id,user_id,role) values
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','creator'),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','creator');
insert into public.works(id,creator_id,title,status,is_public,content_class) values
  ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Purchase Test','published',true,'general');
insert into public.digital_products(id,work_id,creator_id,price,status) values
  ('32000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1200,'active');
insert into public.orders(id,buyer_profile_id,product_id,creator_id,amount,platform_fee,creator_revenue,status,paid_at) values
  ('33000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1200,120,1080,'paid',now());
update public.cloud_ai_settings set generation_enabled=true,daily_cost_limit_micros=1000000 where singleton;
insert into public.cloud_ai_provider_prices(provider_id,model_id,kind,job_type,pricing_version,credits,max_cost_micros,currency,active) values
  ('mock-cloud','mock-image-v1','image','background','phase4-test-v1',1,1000,'USD',true),
  ('mock-cloud','mock-text-v1','text','story','phase4-test-v1',1,500,'USD',true);
insert into public.cloud_projects(id,owner_profile_id,title,visibility) values
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Private Phase 1','private'),
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','Public Phase 1','public');
insert into public.cloud_episodes(id,project_id,title,order_index) values
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Episode 1',0);
insert into public.cloud_pages(id,project_id,episode_id,page_number,order_index,width,height) values
  ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1,0,1600,2400);

insert into storage.objects(id,bucket_id,name,owner_id) values
  ('71000000-0000-4000-8000-000000000001','works','general/legacy-owner-cover.png','20000000-0000-4000-8000-000000000001'),
  ('71000000-0000-4000-8000-000000000002','digital-products','general/legacy-owner-product.pdf','20000000-0000-4000-8000-000000000001');

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';
set local role authenticated;
insert into storage.objects(id,bucket_id,name,owner_id) values
  ('71000000-0000-4000-8000-000000000003','works','20000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000001/cover.png','20000000-0000-4000-8000-000000000001'),
  ('71000000-0000-4000-8000-000000000004','digital-products','20000000-0000-4000-8000-000000000001/32000000-0000-4000-8000-000000000001/product.pdf','20000000-0000-4000-8000-000000000001');
insert into public.cloud_assets(
  id,project_id,owner_profile_id,storage_path,file_name,mime_type,
  byte_size,width,height,sha256
) values (
  '72000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000001.png',
  'owner.png','image/png',100,10,10,repeat('1',64)
);
update storage.objects
set name='20000000-0000-4000-8000-000000000001/31000000-0000-4000-8000-000000000001/cover-v2.png'
where id='71000000-0000-4000-8000-000000000003';
update storage.objects
set name='general/legacy-owner-cover-v2.png'
where id='71000000-0000-4000-8000-000000000001';
do $$
begin
  begin
    insert into storage.objects(id,bucket_id,name,owner_id) values(
      '71000000-0000-4000-8000-000000000005','works',
      'general/new-file-must-not-use-legacy-path.png',
      '20000000-0000-4000-8000-000000000001'
    );
    raise exception 'new works object used the legacy path';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';
set local role authenticated;
do $$
declare
  v_updated integer;
  v_deleted integer;
begin
  begin
    insert into public.cloud_assets(
      id,project_id,owner_profile_id,storage_path,file_name,mime_type,
      byte_size,width,height,sha256
    ) values (
      '72000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000001/72000000-0000-4000-8000-000000000002.png',
      'other.png','image/png',100,10,10,repeat('2',64)
    );
    raise exception 'another user uploaded to a private Cloud Project';
  exception when insufficient_privilege then
    null;
  end;
  update storage.objects
  set name='20000000-0000-4000-8000-000000000002/31000000-0000-4000-8000-000000000001/stolen.png'
  where id='71000000-0000-4000-8000-000000000003';
  get diagnostics v_updated = row_count;
  delete from storage.objects
  where id in (
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000004'
  );
  get diagnostics v_deleted = row_count;
  if v_updated <> 0 or v_deleted <> 0 then
    raise exception 'another user modified Marketplace storage objects';
  end if;
  if exists(select 1 from public.cloud_projects where id='40000000-0000-4000-8000-000000000001') then
    raise exception 'another user can read a private Cloud Project';
  end if;
  if not exists(select 1 from public.cloud_projects where id='40000000-0000-4000-8000-000000000002') then
    raise exception 'public Cloud Project is not readable';
  end if;
  if exists(select 1 from public.cloud_pages where id='60000000-0000-4000-8000-000000000001') then
    raise exception 'another user can read a private Cloud Page';
  end if;
  if not exists(select 1 from public.orders where id='33000000-0000-4000-8000-000000000001') then
    raise exception 'buyer cannot read their paid order';
  end if;
end $$;
reset role;

set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local role anon;
do $$
begin
  begin
    insert into storage.objects(id,bucket_id,name) values(
      '71000000-0000-4000-8000-000000000006','digital-products',
      '20000000-0000-4000-8000-000000000001/32000000-0000-4000-8000-000000000001/anonymous.pdf'
    );
    raise exception 'anonymous user wrote a Marketplace storage object';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
delete from storage.objects
where id in (
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000004'
);
do $$
begin
  if exists(
    select 1 from storage.objects
    where id in (
      '71000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000003',
      '71000000-0000-4000-8000-000000000004'
    )
  ) then
    raise exception 'owner could not delete Marketplace storage objects';
  end if;
end $$;
select * from public.save_cloud_page_snapshot(
  '60000000-0000-4000-8000-000000000001', 0, '{"panels":[]}'::jsonb
);
do $$
declare
  v_import jsonb := jsonb_build_object(
    'format','mangai.cloud-project','version',1,'policyVersion',1,'createdBySurface','desktop',
    'project',jsonb_build_object(
      'sourceProjectId','70000000-0000-4000-8000-000000000001','title','Imported Phase 1',
      'description','','contentClass','general','ageRating','全年齢','readingDirection','rtl',
      'width',1600,'height',2400,'dpi',300
    ),
    'episodes','[]'::jsonb,'pages','[]'::jsonb,'assets','[]'::jsonb,'snapshots','[]'::jsonb
  );
  v_created record;
  v_episode_id uuid;
  v_page_id uuid;
  v_job_id uuid;
  v_duplicate_job_id uuid;
  v_cancel_job_id uuid;
  v_lease_job_id uuid;
begin
  if not exists(
    select 1 from public.cloud_canvas_snapshots
    where page_id='60000000-0000-4000-8000-000000000001' and revision=1
  ) then raise exception 'saved Canvas snapshot cannot be restored'; end if;
  begin
    perform public.save_cloud_page_snapshot(
      '60000000-0000-4000-8000-000000000001', 0, '{"panels":[]}'::jsonb
    );
    raise exception 'stale revision overwrote a Cloud Page';
  exception when others then
    if sqlerrm not like 'revision_conflict:%' then raise; end if;
  end;
  perform public.import_cloud_project(v_import);
  if not exists(
    select 1 from public.cloud_projects
    where source_project_id='70000000-0000-4000-8000-000000000001'
      and source_surface='desktop' and content_class='general'
  ) then raise exception 'general Desktop import was not persisted'; end if;
  begin
    perform public.import_cloud_project(
      jsonb_set(v_import, '{project,contentClass}', '"adult"'::jsonb)
    );
    raise exception 'adult Desktop manifest was imported';
  exception when others then
    if sqlerrm <> 'general_cloud_import_required' then raise; end if;
  end;
  select * into v_created from public.create_cloud_project_with_first_page(
    'Browser Project', 'Phase 2', '全年齢', 'rtl', 1600, 2400, 300
  );
  if not exists(select 1 from public.cloud_projects where id=v_created.project_id and source_surface='cloud')
     or not exists(select 1 from public.cloud_episodes where id=v_created.episode_id and project_id=v_created.project_id)
     or not exists(select 1 from public.cloud_pages where id=v_created.page_id and episode_id=v_created.episode_id)
     or not exists(select 1 from public.cloud_canvas_snapshots where page_id=v_created.page_id and revision=0) then
    raise exception 'Cloud Project first-page transaction is incomplete';
  end if;
  v_episode_id := public.add_cloud_episode(v_created.project_id, '第2話');
  v_page_id := public.add_cloud_page(v_episode_id);
  perform public.add_cloud_page(v_episode_id);
  perform public.move_cloud_page(v_page_id, 1);
  perform public.move_cloud_episode(v_episode_id, -1);
  perform public.rename_cloud_project(v_created.project_id, 'Browser Project Updated', 'Updated');
  perform public.rename_cloud_episode(v_episode_id, '第2話 更新');
  if not exists(select 1 from public.cloud_pages where id=v_page_id and project_id=v_created.project_id)
     or not exists(select 1 from public.cloud_projects where id=v_created.project_id and title='Browser Project Updated' and revision=7)
     or not exists(select 1 from public.cloud_episodes where id=v_episode_id and title='第2話 更新') then
    raise exception 'Cloud structure mutations or revision history are invalid';
  end if;
  v_job_id := public.enqueue_cloud_generation_job_with_quota(
    v_created.project_id, v_created.page_id, 'image', 'background',
    'mock-cloud', 'mock-image-v1', 'phase3-idempotency-1', repeat('a',64),
    '{"kind":"image","jobType":"background","prompt":"green forest"}'::jsonb,
    '{"decision":"allow","reasons":[],"policyVersion":1}'::jsonb
  );
  v_duplicate_job_id := public.enqueue_cloud_generation_job_with_quota(
    v_created.project_id, v_created.page_id, 'image', 'background',
    'mock-cloud', 'mock-image-v1', 'phase3-idempotency-1', repeat('a',64),
    '{"kind":"image","jobType":"background","prompt":"green forest"}'::jsonb,
    '{"decision":"allow","reasons":[],"policyVersion":1}'::jsonb
  );
  if v_job_id <> v_duplicate_job_id then
    raise exception 'Cloud AI idempotency created duplicate jobs';
  end if;
  begin
    perform public.enqueue_cloud_generation_job_with_quota(
      v_created.project_id, v_created.page_id, 'image', 'background',
      'mock-cloud', 'mock-image-v1', 'phase3-blocked', repeat('b',64),
      '{"kind":"image","jobType":"background","prompt":"blocked"}'::jsonb,
      '{"decision":"block","reasons":["adult_content"],"policyVersion":1}'::jsonb
    );
    raise exception 'blocked Cloud AI input was queued';
  exception when others then
    if sqlerrm <> 'cloud_generation_input_rejected' then raise; end if;
  end;
  v_cancel_job_id := public.enqueue_cloud_generation_job_with_quota(
    v_created.project_id, null, 'text', 'story', 'mock-cloud', 'mock-text-v1',
    'phase3-cancel', repeat('c',64),
    '{"kind":"text","jobType":"story","prompt":"friendship"}'::jsonb,
    '{"decision":"allow","reasons":[],"policyVersion":1}'::jsonb
  );
  perform public.cancel_cloud_generation_job(v_cancel_job_id);
  if not exists(select 1 from public.cloud_generation_jobs where id=v_cancel_job_id and status='canceled') then
    raise exception 'Cloud AI cancel did not persist';
  end if;
  if not exists(select 1 from public.cloud_ai_cost_ledger where job_id=v_cancel_job_id and event_type='release') then
    raise exception 'Cloud AI cancel did not release its reservation';
  end if;
  v_lease_job_id := public.enqueue_cloud_generation_job_with_quota(
    v_created.project_id, null, 'text', 'story', 'mock-cloud', 'mock-text-v1',
    'phase3-lease-recovery', repeat('d',64),
    '{"kind":"text","jobType":"story","prompt":"lease recovery"}'::jsonb,
    '{"decision":"allow","reasons":[],"policyVersion":1}'::jsonb
  );
  perform public.set_cloud_project_cover(v_created.project_id,v_page_id);
  perform public.soft_delete_cloud_page(v_page_id);
  perform public.soft_delete_cloud_episode(v_episode_id);
  if exists(select 1 from public.cloud_episodes where id=v_episode_id and deleted_at is null)
     or exists(select 1 from public.cloud_pages where episode_id=v_episode_id and deleted_at is null)
     or exists(select 1 from public.cloud_projects where id=v_created.project_id and cover_page_id is not null) then
    raise exception 'Cloud structure soft delete is invalid';
  end if;
end $$;
reset role;

set local "request.jwt.claim.role" = 'service_role';
set local role service_role;
do $$
declare
  v_claim public.cloud_generation_jobs%rowtype;
  v_expired public.cloud_generation_jobs%rowtype;
  v_reclaimed public.cloud_generation_jobs%rowtype;
  v_old_token uuid;
  v_canceled_job_id uuid;
  v_asset_id uuid := '70000000-0000-4000-8000-000000000001';
  v_original_lease_expires_at timestamptz;
  v_extended_lease_expires_at timestamptz;
  v_applied boolean;
  v_ignored boolean;
begin
  if not public.record_order_download(
    '33000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002'
  ) or not public.record_order_download(
    '33000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002'
  ) then raise exception 'Buyer download recorder rejected a paid order'; end if;
  if public.record_order_download(
    '33000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001'
  ) then raise exception 'Buyer download recorder accepted another buyer'; end if;
  v_applied:=public.apply_cloud_ai_subscription_event(
    'evt_phase4_new','customer.subscription.updated','2026-07-18 08:00:00+00',
    '30000000-0000-4000-8000-000000000001','creator','active',
    '2026-07-01 00:00:00+00','2026-08-01 00:00:00+00','cus_phase4','sub_phase4'
  );
  v_ignored:=public.apply_cloud_ai_subscription_event(
    'evt_phase4_old','customer.subscription.updated','2026-07-18 07:00:00+00',
    '30000000-0000-4000-8000-000000000001','trial','trialing',
    '2026-07-01 00:00:00+00','2026-08-01 00:00:00+00','cus_phase4','sub_phase4'
  );
  if not v_applied or v_ignored or not exists(
    select 1 from public.cloud_ai_entitlements where profile_id='30000000-0000-4000-8000-000000000001'
      and plan_key='creator' and status='active' and source='stripe'
  ) then raise exception 'Stripe Cloud entitlement ordering is invalid'; end if;
  if public.apply_cloud_ai_subscription_event(
    'evt_phase4_new','customer.subscription.updated','2026-07-18 08:00:00+00',
    '30000000-0000-4000-8000-000000000001','creator','active',
    '2026-07-01 00:00:00+00','2026-08-01 00:00:00+00','cus_phase4','sub_phase4'
  ) then raise exception 'Stripe event idempotency failed'; end if;
  select * into v_claim from public.claim_cloud_generation_job('phase3-ci-worker', 120);
  if v_claim.id is null or v_claim.status <> 'running' or v_claim.attempt_count <> 1
     or v_claim.lease_token is null then
    raise exception 'Cloud AI worker could not claim a queued job';
  end if;
  v_original_lease_expires_at := v_claim.lease_expires_at;
  v_extended_lease_expires_at := public.extend_cloud_generation_job_lease(
    v_claim.id,v_claim.lease_token,300
  );
  if v_extended_lease_expires_at<=v_original_lease_expires_at then
    raise exception 'Cloud AI worker heartbeat did not extend the lease';
  end if;
  update public.cloud_ai_settings set daily_cost_limit_micros=900 where singleton;
  perform public.complete_cloud_generation_image_job(
    v_claim.id,v_claim.lease_token,v_asset_id,
    '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001.png',
    'AI-test.png',1024,256,256,repeat('e',64),
    jsonb_build_object('kind','image','assetId',v_asset_id::text),
    'provider-job-1',900
  );
  perform public.complete_cloud_generation_image_job(
    v_claim.id,v_claim.lease_token,v_asset_id,
    '30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001.png',
    'AI-test.png',1024,256,256,repeat('e',64),
    jsonb_build_object('kind','image','assetId',v_asset_id::text),
    'provider-job-1',900
  );
  if not exists(
    select 1 from public.cloud_generation_jobs
    where id=v_claim.id and status='completed' and progress=100
      and actual_cost_micros=900 and output_asset_id=v_asset_id
  ) then raise exception 'Cloud AI worker completion did not persist'; end if;
  select id into v_canceled_job_id
  from public.cloud_generation_jobs
  where idempotency_key='phase3-cancel';
  begin
    perform public.complete_cloud_generation_image_job(
      v_canceled_job_id,gen_random_uuid(),gen_random_uuid(),'invalid/path.png',
      'AI-canceled.png',1024,256,256,repeat('f',64),
      '{"kind":"image","assetId":"00000000-0000-4000-8000-000000000001"}'::jsonb,
      null,0
    );
    raise exception 'canceled Cloud AI job accepted an Asset';
  exception when others then
    if sqlerrm<>'cloud_generation_lease_invalid' then raise; end if;
  end;
  perform public.record_cloud_generation_storage_cleanup(
    v_claim.id,'cloud-assets','pending/test-orphan.png','test','remove failed'
  );
  perform public.record_cloud_generation_storage_cleanup(
    v_claim.id,'cloud-assets','pending/test-orphan.png','test retry','remove failed again'
  );
  if not exists(
    select 1 from public.cloud_generation_storage_cleanup
    where storage_path='pending/test-orphan.png'
      and status='pending' and attempt_count=2
  ) then raise exception 'Cloud storage cleanup retry was not recorded'; end if;
  if exists(select 1 from public.cloud_ai_settings where singleton and generation_enabled) then
    raise exception 'Cloud AI daily budget did not trigger automatic stop';
  end if;
  select * into v_expired from public.claim_cloud_generation_job('phase3-ci-worker', 120);
  v_old_token := v_expired.lease_token;
  update public.cloud_generation_jobs set lease_expires_at=now()-interval '1 second'
  where id=v_expired.id;
  begin
    perform public.extend_cloud_generation_job_lease(
      v_expired.id,v_old_token,300
    );
    raise exception 'expired Cloud AI lease was revived';
  exception when others then
    if sqlerrm<>'cloud_generation_lease_invalid' then raise; end if;
  end;
  select * into v_reclaimed from public.claim_cloud_generation_job('phase3-ci-worker-2', 120);
  if v_reclaimed.id<>v_expired.id or v_reclaimed.lease_token=v_old_token
     or v_reclaimed.attempt_count<>2 then
    raise exception 'expired Cloud AI lease was not reclaimed safely';
  end if;
  begin
    perform public.finish_cloud_generation_job(
      v_expired.id,v_old_token,true,'{}'::jsonb,null,null,0,null,null,false
    );
    raise exception 'stale Cloud AI lease completed a reclaimed job';
  exception when others then
    if sqlerrm<>'cloud_generation_lease_invalid' then raise; end if;
  end;
  perform public.finish_cloud_generation_job(
    v_reclaimed.id,v_reclaimed.lease_token,true,'{"text":"recovered"}'::jsonb,
    null,'provider-job-2',0,null,null,false
  );
  perform public.refresh_cloud_ai_notifications();
  perform public.refresh_cloud_ai_notifications();
  if (select count(*) from public.cloud_ai_notifications where notification_type='generation_stopped')<>1 then
    raise exception 'Cloud AI stop notification deduplication failed';
  end if;
end $$;
reset role;

do $$
begin
  if (
    select count(*)
    from public.cloud_assets asset
    join public.cloud_generation_jobs job
      on job.id=asset.source_generation_job_id
    where job.idempotency_key='phase3-idempotency-1'
  )<>1 or (
    select count(*)
    from public.cloud_ai_cost_ledger ledger
    join public.cloud_generation_jobs job on job.id=ledger.job_id
    where job.idempotency_key='phase3-idempotency-1'
      and ledger.event_type='settle'
  )<>1 then
    raise exception 'Cloud image completion is not idempotent';
  end if;
end $$;

insert into public.cloud_assets(
  id,project_id,owner_profile_id,storage_path,file_name,mime_type,
  byte_size,width,height,sha256,source_generation_job_id
)
select
  '70000000-0000-4000-8000-000000000002',
  job.project_id,job.created_by_profile_id,
  'orphan/canceled-job.png','AI-orphan.png','image/png',
  1024,256,256,repeat('f',64),job.id
from public.cloud_generation_jobs job
where job.idempotency_key='phase3-cancel';

set local "request.jwt.claim.role"='service_role';
set local role service_role;
do $$
declare v_first boolean;v_second boolean;v_blocked boolean;v_orphans integer;
begin
  v_orphans:=public.queue_orphan_cloud_generation_assets();
  if v_orphans<>1 then
    raise exception 'Cloud orphan Asset scan did not queue one Asset';
  end if;
  v_first:=public.consume_cloud_ai_rate_limit('global','phase4-global-rate-key',2,900);
  v_second:=public.consume_cloud_ai_rate_limit('global','phase4-global-rate-key',2,900);
  v_blocked:=public.consume_cloud_ai_rate_limit('global','phase4-global-rate-key',2,900);
  if not v_first or not v_second or v_blocked then
    raise exception 'Cloud AI atomic rate limit did not enforce its limit';
  end if;
end $$;
reset role;

do $$
begin
  if not exists(
    select 1
    from public.cloud_assets asset
    join public.cloud_generation_storage_cleanup cleanup
      on cleanup.storage_path=asset.storage_path
    where asset.id='70000000-0000-4000-8000-000000000002'
      and asset.deleted_at is not null
      and cleanup.status='pending'
      and cleanup.reason='orphan_cloud_generation_asset'
  ) then
    raise exception 'Cloud orphan Asset was not soft-deleted and queued for Storage cleanup';
  end if;
end $$;

do $$
begin
  if not exists(
    select 1 from public.orders
    where id='33000000-0000-4000-8000-000000000001'
      and download_count=2 and last_download_at is not null
  ) then raise exception 'Buyer download count was not updated atomically'; end if;
end $$;

do $$
begin
  if not exists(select 1 from public.cloud_ai_usage_periods where profile_id='30000000-0000-4000-8000-000000000001' and credits_reserved=0 and credits_used=2 and cost_actual_micros=900) then
    raise exception 'Cloud AI quota settlement is invalid';
  end if;
  if (select count(*) from public.cloud_ai_cost_ledger where event_type='reserve')<>3
     or (select count(*) from public.cloud_ai_cost_ledger where event_type='settle')<>2
     or (select count(*) from public.cloud_ai_cost_ledger where event_type='release')<>1 then
    raise exception 'Cloud AI cost ledger lifecycle is incomplete';
  end if;
end $$;
rollback;

do $$
declare
  v_first boolean;
  v_second boolean;
  v_blocked boolean;
begin
  v_first := public.consume_desktop_device_rate_limit('ci-rate-limit-key-0001', 2, 900);
  v_second := public.consume_desktop_device_rate_limit('ci-rate-limit-key-0001', 2, 900);
  v_blocked := public.consume_desktop_device_rate_limit('ci-rate-limit-key-0001', 2, 900);
  if not v_first or not v_second or v_blocked then
    raise exception 'rate limit behavior is invalid: %, %, %', v_first, v_second, v_blocked;
  end if;
end $$;

insert into public.desktop_device_authorizations (
  device_name,
  secret_hash,
  user_code,
  status,
  expires_at
) values (
  'CI expired device',
  repeat('a', 64),
  'CI23-4567',
  'expired',
  now() - interval '2 days'
);

select public.cleanup_desktop_device_authorizations();

do $$
begin
  if exists (
    select 1 from public.desktop_device_authorizations
    where secret_hash = repeat('a', 64)
  ) then
    raise exception 'expired authorization cleanup failed';
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
    raise exception 'Cloud research v2 engine constraint missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_export_jobs') is null
     or to_regclass('public.cloud_export_segments') is null
     or to_regprocedure('public.complete_cloud_export_segment(uuid,uuid,integer,integer,text,jsonb,text,bigint)') is null
     or not exists(select 1 from storage.buckets where id='cloud-exports') then
    raise exception 'Durable export migration objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_page_thumbnails') is null
     or to_regclass('public.cloud_storage_cleanup') is null
     or to_regprocedure('public.claim_cloud_page_thumbnail(text,integer)') is null
     or to_regprocedure('public.claim_cloud_storage_cleanup(text,integer)') is null
     or not exists(select 1 from storage.buckets where id='cloud-cache' and public=false) then
    raise exception 'Cloud storage lifecycle migration objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_continuity_facts') is null
     or to_regclass('public.cloud_plot_threads') is null
     or to_regprocedure('public.save_cloud_continuity_fact(uuid,uuid,text,text,text,text,integer,integer,integer,text)') is null
     or to_regprocedure('public.save_cloud_plot_thread(uuid,uuid,text,integer,integer,integer,text,text)') is null then
    raise exception 'Cloud narrative continuity migration objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_resource_budgets') is null
     or to_regprocedure('public.save_cloud_project_resource_budget(uuid,integer,bigint,bigint,integer,boolean)') is null
     or to_regprocedure('public.get_cloud_project_resource_usage(uuid)') is null
     or to_regprocedure('public.enforce_cloud_project_generation_budget()') is null
     or to_regprocedure('public.enforce_cloud_project_storage_budget()') is null then
    raise exception 'Cloud project resource budget objects missing';
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
    raise exception 'Cloud project checkpoint objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_project_checkpoint_restores') is null
     or to_regprocedure('public.restore_cloud_project_checkpoint(uuid,uuid)') is null then
    raise exception 'Cloud project checkpoint restore objects missing';
  end if;
end $$;

do $$ begin
  if to_regclass('public.cloud_manga_quality_logs') is null
     or to_regprocedure('public.record_cloud_manga_quality_event(uuid,text,text)') is null then
    raise exception 'Cloud manga quality Q0 objects missing';
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
     ) then
    raise exception 'Cloud monitor operations hub objects missing';
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
    raise exception 'Cloud monitor operations Phase 2 objects missing';
  end if;
end $$;
