begin;

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
#variable_conflict error
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
  select project.* into v_project from public.cloud_projects project
    where project.id=p_project_id and project.owner_profile_id=v_profile_id
      and project.content_class='general' and project.deleted_at is null for update;
  if not found then raise exception 'cloud_marketplace_project_not_found';end if;
  select checkpoint.* into v_checkpoint from public.cloud_project_checkpoints checkpoint
    where checkpoint.id=p_checkpoint_id and checkpoint.project_id=p_project_id
      and checkpoint.created_by_profile_id=v_profile_id and checkpoint.kind='release';
  if not found or v_checkpoint.manifest_sha256<>p_manifest_sha256 then raise exception 'cloud_marketplace_release_not_found';end if;
  if jsonb_array_length(p_pages)<>v_checkpoint.page_count then raise exception 'cloud_marketplace_page_count_mismatch';end if;
  if exists(
    select 1 from public.cloud_project_checkpoint_pages checkpoint_page
    where checkpoint_page.checkpoint_id=p_checkpoint_id and not exists(
      select 1 from jsonb_array_elements(p_pages) page
      where (page->>'pageNumber')::integer=checkpoint_page.page_number
        and (page->>'width')::integer between 100 and 20000
        and (page->>'height')::integer between 100 and 20000
        and nullif(page->>'storagePath','') is not null
    )
  ) then raise exception 'cloud_marketplace_pages_invalid';end if;

  select count(*) into v_count from public.works work
    where work.creator_id=v_profile_id and work.source_project_id=p_project_id;
  if v_count>1 then raise exception 'cloud_marketplace_duplicate_works';end if;
  select work.id,work.status,work.is_public into v_work_id,v_work_status,v_work_public
    from public.works work
    where work.creator_id=v_profile_id and work.source_project_id=p_project_id
    order by work.id limit 1 for update;
  if v_work_public or v_work_status='published' then raise exception 'cloud_marketplace_work_published';end if;
  if v_work_id is not null then
    select count(*) into v_count from public.digital_products product
      where product.creator_id=v_profile_id and product.work_id=v_work_id;
    if v_count>1 then raise exception 'cloud_marketplace_duplicate_products';end if;
    select product.id,product.status into v_product_id,v_product_status
      from public.digital_products product
      where product.creator_id=v_profile_id and product.work_id=v_work_id
      order by product.id limit 1 for update;
    if v_product_status='active' then raise exception 'cloud_marketplace_product_active';end if;
  end if;
  if v_work_id is null then
    v_work_id:=gen_random_uuid();
    insert into public.works(id,creator_id,title,description,image_url,sample_image_urls,source_project_id,content_class,tags,status,is_public)
    values(v_work_id,v_profile_id,v_project.title,v_project.description,p_cover_url,array[]::text[],p_project_id,'general',array['漫画',v_project.age_rating],'draft',false);
  end if;
  select coalesce(max(publication.version),0)+1 into v_version
    from public.cloud_work_publications publication where publication.work_id=v_work_id;
  insert into public.cloud_work_publications(id,work_id,project_id,checkpoint_id,created_by_profile_id,version,page_count,cover_url,pdf_storage_path,manifest_sha256)
  values(v_publication_id,v_work_id,p_project_id,p_checkpoint_id,v_profile_id,v_version,v_checkpoint.page_count,p_cover_url,p_product_path,p_manifest_sha256);
  for v_page in select page.value from jsonb_array_elements(p_pages) page loop
    insert into public.cloud_work_publication_pages(publication_id,page_number,width,height,storage_path,is_sample)
    values(v_publication_id,(v_page->>'pageNumber')::integer,(v_page->>'width')::integer,(v_page->>'height')::integer,v_page->>'storagePath',coalesce((v_page->>'isSample')::boolean,false));
  end loop;
  update public.works work set title=v_project.title,description=v_project.description,image_url=p_cover_url,
    sample_image_urls=array[]::text[],content_class='general',tags=array['漫画',v_project.age_rating],status='draft',is_public=false,
    current_publication_id=v_publication_id,published_version=v_version,published_at=null,updated_at=now()
    where work.id=v_work_id;
  if v_product_id is null then
    v_product_id:=gen_random_uuid();
    insert into public.digital_products(id,work_id,creator_id,title,description,file_url,price,status)
    values(v_product_id,v_work_id,v_profile_id,v_project.title||' デジタル版',p_sales_description,p_product_path,p_price,'paused');
  else
    update public.digital_products product set title=v_project.title||' デジタル版',description=p_sales_description,
      file_url=p_product_path,price=p_price,status='paused',updated_at=now() where product.id=v_product_id;
  end if;
  return query select v_work_id,v_product_id,v_publication_id,v_version;
end$$;

revoke all on function public.sync_cloud_marketplace_release_draft(uuid,uuid,text,text,text,jsonb,integer,text) from public,anon;
grant execute on function public.sync_cloud_marketplace_release_draft(uuid,uuid,text,text,text,jsonb,integer,text) to authenticated,service_role;

commit;
