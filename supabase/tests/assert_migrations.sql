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
     or to_regprocedure('public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean)') is null then
    raise exception 'Cloud Creator functions are missing';
  end if;
  if to_regclass('public.cloud_generation_jobs') is null then
    raise exception 'Cloud AI queue table is missing';
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
     or not has_function_privilege('service_role', 'public.claim_cloud_generation_job(text,integer)', 'execute') then
    raise exception 'Cloud worker function privileges are invalid';
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
  if has_function_privilege('anon', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'anon must not execute rate limit function';
  end if;
  if not has_function_privilege('service_role', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'service_role must execute rate limit function';
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

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';
set local role authenticated;
do $$
begin
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

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
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
  perform public.finish_cloud_generation_job(
    v_claim.id, v_claim.lease_token, true, '{"text":"done"}'::jsonb,
    null, 'provider-job-1', 900, null, null, false
  );
  if not exists(
    select 1 from public.cloud_generation_jobs
    where id=v_claim.id and status='completed' and progress=100 and actual_cost_micros=900
  ) then raise exception 'Cloud AI worker completion did not persist'; end if;
  select * into v_expired from public.claim_cloud_generation_job('phase3-ci-worker', 120);
  v_old_token := v_expired.lease_token;
  update public.cloud_generation_jobs set lease_expires_at=now()-interval '1 second'
  where id=v_expired.id;
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
end $$;
reset role;

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
