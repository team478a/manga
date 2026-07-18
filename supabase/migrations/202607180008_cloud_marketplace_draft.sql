begin;

create or replace function public.sync_cloud_marketplace_draft(
  p_project_id uuid,
  p_expected_revision bigint,
  p_cover_url text,
  p_product_path text,
  p_price integer,
  p_sales_description text
) returns table(work_id uuid,product_id uuid)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_project public.cloud_projects%rowtype;
  v_work_id uuid;
  v_work_status text;
  v_work_public boolean;
  v_product_id uuid;
  v_product_status text;
  v_count integer;
begin
  if v_profile_id is null then raise exception 'cloud_marketplace_auth_required'; end if;
  if p_price<0 or p_price>1000000 or nullif(trim(p_cover_url),'') is null
     or nullif(trim(p_product_path),'') is null or char_length(p_sales_description)>5000 then
    raise exception 'cloud_marketplace_input_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
  select * into v_project from public.cloud_projects
  where id=p_project_id and owner_profile_id=v_profile_id
    and content_class='general' and deleted_at is null for update;
  if not found then raise exception 'cloud_marketplace_project_not_found'; end if;
  if v_project.revision<>p_expected_revision then
    raise exception 'cloud_marketplace_revision_conflict';
  end if;

  select count(*) into v_count from public.works
  where creator_id=v_profile_id and source_project_id=p_project_id;
  if v_count>1 then raise exception 'cloud_marketplace_duplicate_works'; end if;
  select id,status,is_public into v_work_id,v_work_status,v_work_public
  from public.works where creator_id=v_profile_id and source_project_id=p_project_id
  order by id limit 1 for update;
  if v_work_public or v_work_status='published' then
    raise exception 'cloud_marketplace_work_published';
  end if;

  if v_work_id is not null then
    select count(*) into v_count from public.digital_products dp
    where dp.creator_id=v_profile_id and dp.work_id=v_work_id;
    if v_count>1 then raise exception 'cloud_marketplace_duplicate_products'; end if;
    select id,status into v_product_id,v_product_status
    from public.digital_products dp where dp.creator_id=v_profile_id and dp.work_id=v_work_id
    order by id limit 1 for update;
    if v_product_status='active' then
      raise exception 'cloud_marketplace_product_active';
    end if;
  end if;

  if v_work_id is null then
    v_work_id:=gen_random_uuid();
    execute 'insert into public.works(id,creator_id,title,description,image_url,sample_image_urls,source_project_id,content_class,tags,status,is_public) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)'
      using v_work_id,v_profile_id,v_project.title,v_project.description,p_cover_url,array[]::text[],p_project_id,'general',array['漫画',v_project.age_rating], 'draft',false;
  else
    execute 'update public.works set title=$1,description=$2,image_url=$3,sample_image_urls=$4,content_class=$5,tags=$6,status=$7,is_public=$8,updated_at=now() where id=$9'
      using v_project.title,v_project.description,p_cover_url,array[]::text[],'general',array['漫画',v_project.age_rating],'draft',false,v_work_id;
  end if;

  if v_product_id is null then
    v_product_id:=gen_random_uuid();
    execute 'insert into public.digital_products(id,work_id,creator_id,title,description,file_url,price,status) values($1,$2,$3,$4,$5,$6,$7,$8)'
      using v_product_id,v_work_id,v_profile_id,v_project.title||' デジタル版',p_sales_description,p_product_path,p_price,'paused';
  else
    execute 'update public.digital_products set title=$1,description=$2,file_url=$3,price=$4,status=$5,updated_at=now() where id=$6'
      using v_project.title||' デジタル版',p_sales_description,p_product_path,p_price,'paused',v_product_id;
  end if;
  return query select v_work_id,v_product_id;
end;
$$;

revoke all on function public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text) from public,anon;
grant execute on function public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text) to authenticated,service_role;

commit;
