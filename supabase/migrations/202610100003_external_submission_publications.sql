begin;

alter table public.cloud_work_publications
  alter column project_id drop not null,
  alter column checkpoint_id drop not null,
  alter column cover_url drop not null,
  alter column pdf_bucket drop not null,
  alter column pdf_storage_path drop not null;

alter table public.cloud_work_publications
  add column if not exists source_kind text not null default 'cloud',
  add column if not exists external_submission_id uuid
    references public.external_work_submissions(id) on delete restrict,
  add column if not exists cover_storage_bucket text,
  add column if not exists cover_storage_path text;

alter table public.cloud_work_publications
  drop constraint if exists cloud_work_publications_source_check;
alter table public.cloud_work_publications
  add constraint cloud_work_publications_source_check check (
    (
      source_kind='cloud'
      and project_id is not null
      and checkpoint_id is not null
      and external_submission_id is null
      and cover_url is not null
      and pdf_bucket='digital-products'
      and pdf_storage_path is not null
      and cover_storage_bucket is null
      and cover_storage_path is null
    ) or (
      source_kind='external'
      and project_id is null
      and checkpoint_id is null
      and external_submission_id is not null
      and cover_url is null
      and pdf_bucket is null
      and pdf_storage_path is null
      and cover_storage_bucket='external-submission-pages'
      and cover_storage_path is not null
    )
  );

alter table public.cloud_work_publication_pages
  drop constraint if exists cloud_work_publication_pages_storage_bucket_check;
alter table public.cloud_work_publication_pages
  add constraint cloud_work_publication_pages_storage_bucket_check
  check(storage_bucket in('digital-products','external-submission-pages'));

create unique index if not exists cloud_work_publications_external_submission_idx
on public.cloud_work_publications(external_submission_id)
where external_submission_id is not null;

alter table public.works
  add column if not exists external_submission_id uuid
    references public.external_work_submissions(id) on delete restrict;
create unique index if not exists works_external_submission_idx
on public.works(external_submission_id)
where external_submission_id is not null;

alter table public.external_work_submissions
  add column if not exists work_id uuid references public.works(id) on delete restrict,
  add column if not exists publication_id uuid
    references public.cloud_work_publications(id) on delete restrict;
create unique index if not exists external_work_submissions_work_idx
on public.external_work_submissions(work_id) where work_id is not null;
create unique index if not exists external_work_submissions_publication_idx
on public.external_work_submissions(publication_id) where publication_id is not null;

alter table public.orders
  add column if not exists publication_id uuid
    references public.cloud_work_publications(id) on delete restrict;
create index if not exists orders_publication_idx
on public.orders(publication_id) where publication_id is not null;

create or replace function public.fix_order_publication_version()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_current_publication_id uuid;
begin
  select work.current_publication_id into v_current_publication_id
  from public.digital_products product
  join public.works work on work.id=product.work_id
  where product.id=new.product_id;
  if v_current_publication_id is not null then
    if new.publication_id is not null and new.publication_id<>v_current_publication_id then
      raise exception 'order_publication_version_mismatch';
    end if;
    new.publication_id:=v_current_publication_id;
  elsif new.publication_id is not null then
    raise exception 'order_publication_version_mismatch';
  end if;
  return new;
end$$;
drop trigger if exists orders_fix_publication_version on public.orders;
create trigger orders_fix_publication_version before insert or update of product_id,publication_id
on public.orders for each row execute function public.fix_order_publication_version();

alter table public.external_work_submission_events
drop constraint if exists external_work_submission_events_event_type_check;
alter table public.external_work_submission_events add constraint
external_work_submission_events_event_type_check check(event_type in(
  'created','rights_declared','status_changed','upload_registered',
  'validation_queued','validation_completed','validation_failed','pages_reordered',
  'samples_updated','publication_created'
));

create or replace function public.set_external_submission_sample_pages(
  p_submission_id uuid,
  p_page_ids uuid[]
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;
  v_page_count integer;v_sample_count integer;
begin
  select * into v_submission from public.external_work_submissions
  where id=p_submission_id and owner_profile_id=v_owner for update;
  if not found or v_submission.status not in('ready','rejected') then
    raise exception 'external_samples_forbidden';end if;
  select count(*) into v_page_count from public.external_work_submission_pages
  where submission_id=p_submission_id and validation_status='validated';
  v_sample_count:=coalesce(array_length(p_page_ids,1),0);
  if v_page_count not between 1 and 100 or v_sample_count<1
     or v_sample_count>least(10,v_page_count)
     or (v_page_count>1 and v_sample_count>=v_page_count)
     or v_sample_count<>(select count(distinct page_id) from unnest(p_page_ids) page_id)
     or exists(select 1 from unnest(p_page_ids) page_id where not exists(
       select 1 from public.external_work_submission_pages page
       where page.id=page_id and page.submission_id=p_submission_id
         and page.validation_status='validated'
     )) then raise exception 'external_samples_invalid';end if;
  update public.external_work_submission_pages page set is_sample=page.id=any(p_page_ids)
  where page.submission_id=p_submission_id;
  update public.external_work_submissions set version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status
  ) values(p_submission_id,v_owner,'samples_updated',v_submission.status,v_submission.status);
  return p_submission_id;
end$$;

create or replace function public.create_external_work_publication(
  p_submission_id uuid
) returns table(work_id uuid,publication_id uuid,publication_version integer)
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
#variable_conflict error
declare
  v_actor uuid:=public.current_profile_id();
  v_submission public.external_work_submissions%rowtype;
  v_work_id uuid:=gen_random_uuid();
  v_publication_id uuid:=gen_random_uuid();
  v_page_count integer;
  v_sample_count integer;
  v_manifest_sha256 text;
  v_cover_path text;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'external_publication_admin_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,0));
  select submission.* into v_submission
  from public.external_work_submissions submission
  where submission.id=p_submission_id for update;
  if not found or v_submission.status<>'approved'
     or v_submission.content_class<>'general'
     or v_submission.work_id is not null
     or v_submission.publication_id is not null then
    raise exception 'external_publication_submission_invalid';
  end if;
  if not exists(
    select 1 from public.external_seller_profiles seller
    where seller.profile_id=v_submission.owner_profile_id and seller.status='eligible'
  ) or not exists(
    select 1 from public.external_work_rights_declarations declaration
    where declaration.id=(
      select latest.id from public.external_work_rights_declarations latest
      where latest.submission_id=p_submission_id
      order by latest.created_at desc,latest.id desc limit 1
    )
      and declaration.rights_holder_confirmed
      and declaration.third_party_permissions_confirmed
      and declaration.ai_use_disclosed
      and declaration.adult_content_absent
  ) then raise exception 'external_publication_qualification_invalid';end if;

  select count(*),
    encode(digest(string_agg(
      page.position::text||':'||page.sha256||':'||page.width::text||'x'||page.height::text,
      ',' order by page.position
    ),'sha256'),'hex'),
    max(page.storage_path) filter(where page.position=1)
  into v_page_count,v_manifest_sha256,v_cover_path
  from public.external_work_submission_pages page
  where page.submission_id=p_submission_id and page.validation_status='validated';
  if v_page_count not between 1 and 100
     or exists(
       select 1 from generate_series(1,v_page_count) expected
       left join public.external_work_submission_pages page
         on page.submission_id=p_submission_id and page.position=expected
       where page.id is null
     ) or v_cover_path is null then
    raise exception 'external_publication_pages_invalid';
  end if;

  select count(*) into v_sample_count from public.external_work_submission_pages
  where submission_id=p_submission_id and validation_status='validated' and is_sample;
  if v_sample_count<1 or v_sample_count>least(10,v_page_count)
     or (v_page_count>1 and v_sample_count>=v_page_count) then
    raise exception 'external_publication_samples_invalid';end if;
  insert into public.works(
    id,creator_id,title,description,image_url,sample_image_urls,source_project_id,
    external_submission_id,content_class,tags,status,is_public
  ) values(
    v_work_id,v_submission.owner_profile_id,v_submission.title,v_submission.description,
    null,array[]::text[],null,p_submission_id,'general',
    array['漫画',v_submission.age_rating],'draft',false
  );
  insert into public.cloud_work_publications(
    id,work_id,project_id,checkpoint_id,created_by_profile_id,version,page_count,
    cover_url,pdf_bucket,pdf_storage_path,manifest_sha256,source_kind,
    external_submission_id,cover_storage_bucket,cover_storage_path
  ) values(
    v_publication_id,v_work_id,null,null,v_submission.owner_profile_id,1,v_page_count,
    null,null,null,v_manifest_sha256,'external',p_submission_id,
    'external-submission-pages',v_cover_path
  );
  insert into public.cloud_work_publication_pages(
    publication_id,page_number,width,height,storage_bucket,storage_path,is_sample
  ) select
    v_publication_id,page.position,page.width,page.height,
    'external-submission-pages',page.storage_path,page.is_sample
  from public.external_work_submission_pages page
  where page.submission_id=p_submission_id order by page.position;
  update public.works work set
    current_publication_id=v_publication_id,published_version=1,published_at=null,updated_at=now()
  where work.id=v_work_id;
  update public.external_work_submissions submission set
    work_id=v_work_id,publication_id=v_publication_id,version=submission.version+1,updated_at=now()
  where submission.id=p_submission_id;
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status
  ) values(p_submission_id,v_actor,'publication_created','approved','approved');
  return query select v_work_id,v_publication_id,1;
end$$;

revoke all on function public.set_external_submission_sample_pages(uuid,uuid[])
from public,anon,authenticated,service_role;
revoke all on function public.create_external_work_publication(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.set_external_submission_sample_pages(uuid,uuid[])
to authenticated;
grant execute on function public.create_external_work_publication(uuid)
to authenticated;

commit;
