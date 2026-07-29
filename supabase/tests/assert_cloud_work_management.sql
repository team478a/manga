\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email) values
  ('a1000000-0000-4000-8000-000000000001','work-owner@example.test'),
  ('a1000000-0000-4000-8000-000000000002','work-other@example.test');
insert into public.profiles(id,user_id,role) values
  ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','creator'),
  ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','creator')
on conflict (user_id) do nothing;
insert into public.cloud_projects(
  id,owner_profile_id,title,description
) values (
  'a3000000-0000-4000-8000-000000000001',
  (select id from public.profiles where user_id='a1000000-0000-4000-8000-000000000001'),
  'Release 5 test',
  '公開前確認を行う作品'
);
insert into public.cloud_episodes(id,project_id,title,order_index) values (
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  '第1話',
  0
);
insert into public.cloud_pages(
  id,project_id,episode_id,page_number,order_index,width,height
) values (
  'a5000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  1,0,1600,2400
);
insert into public.cloud_canvas_snapshots(
  project_id,page_id,revision,canvas,created_by_profile_id
) values (
  'a3000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  0,
  '{"schemaVersion":1,"panels":[]}'::jsonb,
  (select id from public.profiles where user_id='a1000000-0000-4000-8000-000000000001')
);
update public.cloud_projects
set cover_page_id='a5000000-0000-4000-8000-000000000001'
where id='a3000000-0000-4000-8000-000000000001';

set local "request.jwt.claim.sub"='a1000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role"='authenticated';
set local role authenticated;

select public.set_cloud_work_page_review(
  'a3000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  true,
  '確認済み'
);
select public.set_cloud_work_management_status(
  'a3000000-0000-4000-8000-000000000001',
  'review_ready',
  '販売準備メモ',
  0
);
select public.set_cloud_work_management_status(
  'a3000000-0000-4000-8000-000000000001',
  'approved',
  '販売準備メモ',
  0
);

reset role;
do $$
begin
  if not exists(
    select 1 from public.cloud_work_management_states
    where project_id='a3000000-0000-4000-8000-000000000001'
      and owner_profile_id=(
        select id from public.profiles
        where user_id='a1000000-0000-4000-8000-000000000001'
      )
      and status='approved'
      and expected_project_revision=0
      and approved_at is not null
  ) or not exists(
    select 1 from public.cloud_work_page_reviews
    where page_id='a5000000-0000-4000-8000-000000000001'
      and page_revision=0
      and note='確認済み'
  ) then
    raise exception 'Cloud work approval lifecycle was not persisted';
  end if;
end $$;

set local "request.jwt.claim.sub"='a1000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role"='authenticated';
set local role authenticated;
select public.rename_cloud_project(
  'a3000000-0000-4000-8000-000000000001',
  'Release 5 revised',
  '改訂後'
);

reset role;
do $$
begin
  if not exists(
    select 1 from public.cloud_work_management_states
    where project_id='a3000000-0000-4000-8000-000000000001'
      and status='draft'
      and expected_project_revision is null
      and approved_at is null
  ) then
    raise exception 'Project revision did not invalidate Cloud work approval';
  end if;
end $$;

reset role;
set local "request.jwt.claim.sub"='a1000000-0000-4000-8000-000000000002';
set local "request.jwt.claim.role"='authenticated';
set local role authenticated;
do $$
begin
  begin
    perform public.set_cloud_work_page_review(
      'a3000000-0000-4000-8000-000000000001',
      'a5000000-0000-4000-8000-000000000001',
      true,
      ''
    );
    raise exception 'another owner changed Cloud work review';
  exception when others then
    if sqlerrm <> 'cloud_work_project_not_found' then raise; end if;
  end;
end $$;

rollback;
