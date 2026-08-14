begin;

create table if not exists public.cloud_work_publications (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  project_id uuid not null references public.cloud_projects(id) on delete restrict,
  checkpoint_id uuid not null references public.cloud_project_checkpoints(id) on delete restrict,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  version integer not null check(version>0),
  page_count integer not null check(page_count between 1 and 100),
  cover_url text not null check(char_length(cover_url) between 1 and 2000),
  pdf_bucket text not null default 'digital-products' check(pdf_bucket='digital-products'),
  pdf_storage_path text not null check(char_length(pdf_storage_path) between 1 and 1000),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique(work_id,version),
  unique(work_id,checkpoint_id)
);

create table if not exists public.cloud_work_publication_pages (
  publication_id uuid not null references public.cloud_work_publications(id) on delete cascade,
  page_number integer not null check(page_number between 1 and 10000),
  width integer not null check(width between 100 and 20000),
  height integer not null check(height between 100 and 20000),
  storage_bucket text not null default 'digital-products' check(storage_bucket='digital-products'),
  storage_path text not null check(char_length(storage_path) between 1 and 1000),
  is_sample boolean not null default false,
  primary key(publication_id,page_number),
  unique(publication_id,storage_path)
);

alter table public.works add column if not exists current_publication_id uuid references public.cloud_work_publications(id) on delete restrict;
alter table public.works add column if not exists published_version integer check(published_version is null or published_version>0);
alter table public.works add column if not exists published_at timestamptz;

create index if not exists cloud_work_publications_project_idx on public.cloud_work_publications(project_id,created_at desc);
create index if not exists cloud_work_publication_pages_publication_idx on public.cloud_work_publication_pages(publication_id,page_number);
create index if not exists works_current_publication_idx on public.works(current_publication_id) where current_publication_id is not null;

alter table public.cloud_work_publications enable row level security;
alter table public.cloud_work_publication_pages enable row level security;
grant select on public.cloud_work_publications,public.cloud_work_publication_pages to authenticated;
grant select,insert,update,delete on public.cloud_work_publications,public.cloud_work_publication_pages to service_role;

drop policy if exists "cloud_work_publications_read" on public.cloud_work_publications;
create policy "cloud_work_publications_read" on public.cloud_work_publications for select using(
  created_by_profile_id=public.current_profile_id()
  or exists(select 1 from public.works w where w.id=work_id and w.is_public=true and w.status='published' and w.current_publication_id=cloud_work_publications.id)
);
drop policy if exists "cloud_work_publication_pages_read" on public.cloud_work_publication_pages;
create policy "cloud_work_publication_pages_read" on public.cloud_work_publication_pages for select using(
  exists(select 1 from public.cloud_work_publications p where p.id=publication_id)
);

create or replace function public.sync_cloud_marketplace_release_draft(
  p_project_id uuid,
  p_checkpoint_id uuid,
  p_manifest_sha256 text,
  p_cover_url text,
  p_product_path text,
  p_pages jsonb,
  p_price integer,
  p_sales_description text
) returns table(work_id uuid,product_id uuid,publication_id uuid,publication_version integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_project public.cloud_projects%rowtype;
  v_checkpoint public.cloud_project_checkpoints%rowtype;
  v_work_id uuid;v_work_status text;v_work_public boolean;
  v_product_id uuid;v_product_status text;v_count integer;v_version integer;
  v_publication_id uuid:=gen_random_uuid();v_page jsonb;
begin
  if v_profile_id is null then raise exception 'cloud_marketplace_auth_required';end if;
  if p_price<0 or p_price>1000000 or nullif(trim(p_cover_url),'') is null
    or nullif(trim(p_product_path),'') is null or char_length(p_sales_description)>5000
    or jsonb_typeof(p_pages)<>'array' then raise exception 'cloud_marketplace_input_invalid';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
  select * into v_project from public.cloud_projects where id=p_project_id and owner_profile_id=v_profile_id
    and content_class='general' and deleted_at is null for update;
  if not found then raise exception 'cloud_marketplace_project_not_found';end if;
  select * into v_checkpoint from public.cloud_project_checkpoints where id=p_checkpoint_id
    and project_id=p_project_id and created_by_profile_id=v_profile_id and kind='release';
  if not found or v_checkpoint.manifest_sha256<>p_manifest_sha256 then raise exception 'cloud_marketplace_release_not_found';end if;
  if jsonb_array_length(p_pages)<>v_checkpoint.page_count then raise exception 'cloud_marketplace_page_count_mismatch';end if;
  if exists(
    select 1 from public.cloud_project_checkpoint_pages cp
    where cp.checkpoint_id=p_checkpoint_id and not exists(
      select 1 from jsonb_array_elements(p_pages) page
      where (page->>'pageNumber')::integer=cp.page_number
        and (page->>'width')::integer between 100 and 20000
        and (page->>'height')::integer between 100 and 20000
        and nullif(page->>'storagePath','') is not null
    )
  ) then raise exception 'cloud_marketplace_pages_invalid';end if;

  select count(*) into v_count from public.works where creator_id=v_profile_id and source_project_id=p_project_id;
  if v_count>1 then raise exception 'cloud_marketplace_duplicate_works';end if;
  select id,status,is_public into v_work_id,v_work_status,v_work_public from public.works
    where creator_id=v_profile_id and source_project_id=p_project_id order by id limit 1 for update;
  if v_work_public or v_work_status='published' then raise exception 'cloud_marketplace_work_published';end if;
  if v_work_id is not null then
    select count(*) into v_count from public.digital_products where creator_id=v_profile_id and work_id=v_work_id;
    if v_count>1 then raise exception 'cloud_marketplace_duplicate_products';end if;
    select id,status into v_product_id,v_product_status from public.digital_products
      where creator_id=v_profile_id and work_id=v_work_id order by id limit 1 for update;
    if v_product_status='active' then raise exception 'cloud_marketplace_product_active';end if;
  end if;
  if v_work_id is null then
    v_work_id:=gen_random_uuid();
    insert into public.works(id,creator_id,title,description,image_url,sample_image_urls,source_project_id,content_class,tags,status,is_public)
    values(v_work_id,v_profile_id,v_project.title,v_project.description,p_cover_url,array[]::text[],p_project_id,'general',array['漫画',v_project.age_rating],'draft',false);
  end if;
  select coalesce(max(version),0)+1 into v_version from public.cloud_work_publications where work_id=v_work_id;
  insert into public.cloud_work_publications(id,work_id,project_id,checkpoint_id,created_by_profile_id,version,page_count,cover_url,pdf_storage_path,manifest_sha256)
  values(v_publication_id,v_work_id,p_project_id,p_checkpoint_id,v_profile_id,v_version,v_checkpoint.page_count,p_cover_url,p_product_path,p_manifest_sha256);
  for v_page in select value from jsonb_array_elements(p_pages) loop
    insert into public.cloud_work_publication_pages(publication_id,page_number,width,height,storage_path,is_sample)
    values(v_publication_id,(v_page->>'pageNumber')::integer,(v_page->>'width')::integer,(v_page->>'height')::integer,v_page->>'storagePath',coalesce((v_page->>'isSample')::boolean,false));
  end loop;
  update public.works set title=v_project.title,description=v_project.description,image_url=p_cover_url,
    sample_image_urls=array[]::text[],content_class='general',tags=array['漫画',v_project.age_rating],status='draft',is_public=false,
    current_publication_id=v_publication_id,published_version=v_version,published_at=null,updated_at=now() where id=v_work_id;
  if v_product_id is null then
    v_product_id:=gen_random_uuid();
    insert into public.digital_products(id,work_id,creator_id,title,description,file_url,price,status)
    values(v_product_id,v_work_id,v_profile_id,v_project.title||' デジタル版',p_sales_description,p_product_path,p_price,'paused');
  else
    update public.digital_products set title=v_project.title||' デジタル版',description=p_sales_description,
      file_url=p_product_path,price=p_price,status='paused',updated_at=now() where id=v_product_id;
  end if;
  return query select v_work_id,v_product_id,v_publication_id,v_version;
end$$;

create or replace function public.select_cloud_work_publication(p_work_id uuid,p_publication_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile uuid:=public.current_profile_id();v_work public.works%rowtype;v_publication public.cloud_work_publications%rowtype;
begin
  select * into v_work from public.works where id=p_work_id and creator_id=v_profile for update;
  if not found then raise exception 'cloud_work_publication_not_owned';end if;
  if v_work.is_public or v_work.status='published' or exists(select 1 from public.digital_products where work_id=p_work_id and status='active')
    then raise exception 'cloud_work_publication_in_use';end if;
  select * into v_publication from public.cloud_work_publications where id=p_publication_id and work_id=p_work_id;
  if not found then raise exception 'cloud_work_publication_not_found';end if;
  update public.works set current_publication_id=v_publication.id,published_version=v_publication.version,
    image_url=v_publication.cover_url,published_at=null,updated_at=now() where id=p_work_id;
  update public.digital_products set file_url=v_publication.pdf_storage_path,updated_at=now() where work_id=p_work_id and creator_id=v_profile;
  return true;
end$$;

revoke all on function public.sync_cloud_marketplace_release_draft(uuid,uuid,text,text,text,jsonb,integer,text) from public,anon;
grant execute on function public.sync_cloud_marketplace_release_draft(uuid,uuid,text,text,text,jsonb,integer,text) to authenticated,service_role;
revoke all on function public.select_cloud_work_publication(uuid,uuid) from public,anon;
grant execute on function public.select_cloud_work_publication(uuid,uuid) to authenticated,service_role;

create or replace function public.enforce_cloud_work_publication_gate() returns trigger language plpgsql set search_path=public as $$
begin
  if new.source_project_id is not null and (new.is_public or new.status='published') then
    if new.current_publication_id is null or not exists(
      select 1 from public.cloud_work_publications p where p.id=new.current_publication_id and p.work_id=new.id
        and p.project_id=new.source_project_id and p.page_count>0
    ) then raise exception 'cloud_work_publication_required';end if;
    new.published_version:=(select version from public.cloud_work_publications where id=new.current_publication_id);
    new.published_at:=coalesce(new.published_at,now());
  elsif not new.is_public then new.published_at:=null;end if;
  return new;
end$$;
drop trigger if exists works_cloud_publication_gate on public.works;
create trigger works_cloud_publication_gate before insert or update of is_public,status,current_publication_id on public.works
for each row execute function public.enforce_cloud_work_publication_gate();

create or replace function public.enforce_cloud_product_publication_gate() returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='active' and exists(select 1 from public.works w where w.id=new.work_id and w.source_project_id is not null
    and (w.current_publication_id is null or not w.is_public or w.status<>'published'))
  then raise exception 'cloud_product_publication_required';end if;
  return new;
end$$;
drop trigger if exists digital_products_cloud_publication_gate on public.digital_products;
create trigger digital_products_cloud_publication_gate before insert or update of status,work_id on public.digital_products
for each row execute function public.enforce_cloud_product_publication_gate();

commit;
