\set ON_ERROR_STOP on

begin;
insert into auth.users(id,email) values
  ('81000000-0000-4000-8000-000000000001','marketplace@example.test');
delete from public.profiles
where user_id='81000000-0000-4000-8000-000000000001';
insert into public.profiles(id,user_id,role) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','creator');
insert into public.cloud_projects(
  id,owner_profile_id,title,description,content_class,age_rating,revision
) values (
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'Marketplace Test','Description','general','全年齢',3
);

set local "request.jwt.claim.sub"='81000000-0000-4000-8000-000000000001';
set local "request.jwt.claim.role"='authenticated';
set local role service_role;
select * from public.sync_cloud_marketplace_draft(
  '83000000-0000-4000-8000-000000000001',3,
  'https://example.test/cover.png','general/market/main.pdf',900,'Sales'
);
select * from public.sync_cloud_marketplace_draft(
  '83000000-0000-4000-8000-000000000001',3,
  'https://example.test/cover2.png','general/market/main2.pdf',1200,'Sales 2'
);
reset role;

do $$
begin
  if (select count(*) from public.works where source_project_id='83000000-0000-4000-8000-000000000001')<>1
     or (select count(*) from public.digital_products where creator_id='82000000-0000-4000-8000-000000000001')<>1
     or not exists(
       select 1 from public.digital_products
       where creator_id='82000000-0000-4000-8000-000000000001'
         and price=1200 and status='paused'
         and file_url='general/market/main2.pdf'
     ) then
    raise exception 'Cloud Marketplace sync is not idempotent';
  end if;
end $$;

update public.digital_products set status='active'
where creator_id='82000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
begin
  perform public.sync_cloud_marketplace_draft(
    '83000000-0000-4000-8000-000000000001',3,
    'https://example.test/cover3.png','general/market/main3.pdf',1300,'Sales 3'
  );
  raise exception 'Cloud Marketplace overwrote an active product';
exception when others then
  if sqlerrm<>'cloud_marketplace_product_active' then raise; end if;
end $$;
reset role;
rollback;
