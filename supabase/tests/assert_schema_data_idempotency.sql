\set ON_ERROR_STOP on

begin;

insert into auth.users(id,email) values
  ('91000000-0000-4000-8000-000000000001','schema-idempotency@example.test');
delete from public.profiles
where user_id='91000000-0000-4000-8000-000000000001';
insert into public.profiles(id,user_id,role) values
  ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','creator');
insert into public.works(
  id,creator_id,title,tags,content_class,status,is_public
) values (
  '93000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'Schema data idempotency',
  array['全年齢']::text[],
  'adult',
  'draft',
  false
);

\ir ../schema.sql

do $$
begin
  if (
    select content_class
    from public.works
    where id='93000000-0000-4000-8000-000000000001'
  ) <> 'adult' then
    raise exception 'canonical schema reapplication changed existing content_class';
  end if;
end
$$;

rollback;
