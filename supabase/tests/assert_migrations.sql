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
     or to_regprocedure('public.set_cloud_project_cover(uuid,uuid)') is null then
    raise exception 'Cloud Creator functions are missing';
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
