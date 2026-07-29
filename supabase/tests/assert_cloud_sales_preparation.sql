\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email) values
  ('b1000000-0000-4000-8000-000000000001','sales-owner@example.test');
insert into public.profiles(id,user_id,role) values
  ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','creator')
on conflict(user_id) do nothing;
insert into public.cloud_projects(
  id,owner_profile_id,title,description,content_class,age_rating,revision
) values (
  'b3000000-0000-4000-8000-000000000001',
  (select id from public.profiles where user_id='b1000000-0000-4000-8000-000000000001'),
  'Release 6 test','販売準備を行う作品','general','全年齢',4
);
insert into public.cloud_work_management_states(
  owner_profile_id,project_id,status,expected_project_revision,
  review_ready_at,approved_at
) values (
  (select id from public.profiles where user_id='b1000000-0000-4000-8000-000000000001'),
  'b3000000-0000-4000-8000-000000000001','approved',4,now(),now()
);

set local "request.jwt.claim.sub"='b1000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role"='authenticated';
set local role authenticated;
select * from public.sync_cloud_sales_preparation(
  'b3000000-0000-4000-8000-000000000001',4,
  'https://example.test/release6-cover.png',
  'b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/main.pdf',
  900,'販売説明'
);
select * from public.sync_cloud_sales_preparation(
  'b3000000-0000-4000-8000-000000000001',4,
  'https://example.test/release6-cover-2.png',
  'b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/main-2.pdf',
  1200,'販売説明2'
);
reset role;

do $$
begin
  if (select count(*) from public.works
      where source_project_id='b3000000-0000-4000-8000-000000000001')<>1
     or (select count(*) from public.cloud_sales_preparations
         where project_id='b3000000-0000-4000-8000-000000000001')<>1
     or not exists(
       select 1 from public.cloud_sales_preparations
       where project_id='b3000000-0000-4000-8000-000000000001'
         and project_revision=4
         and price=1200
     ) then
    raise exception 'Cloud sales preparation is not idempotent';
  end if;
end $$;

update public.cloud_projects
set revision=5,updated_at=now()
where id='b3000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.sub"='b1000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role"='authenticated';
set local role authenticated;
do $$
begin
  begin
    perform public.sync_cloud_sales_preparation(
      'b3000000-0000-4000-8000-000000000001',5,
      'https://example.test/release6-cover-3.png',
      'b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001/main-3.pdf',
      1300,'販売説明3'
    );
    raise exception 'Cloud sales preparation ignored stale approval';
  exception when others then
    if sqlerrm<>'cloud_sales_approval_required' then raise; end if;
  end;
end $$;
reset role;

rollback;
