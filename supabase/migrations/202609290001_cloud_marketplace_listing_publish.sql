begin;

create or replace function public.publish_cloud_marketplace_listing(p_project_id uuid)
returns table(work_id uuid,product_id uuid,publication_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_work public.works%rowtype;
  v_product public.digital_products%rowtype;
  v_publication public.cloud_work_publications%rowtype;
  v_count integer;
begin
  if v_profile_id is null then raise exception 'cloud_marketplace_listing_auth_required';end if;
  if p_project_id is null then raise exception 'cloud_marketplace_listing_input_invalid';end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));

  select work.* into v_work from public.works work
    where work.creator_id=v_profile_id and work.source_project_id=p_project_id
    order by work.id limit 1 for update;
  if v_work.id is null or v_work.content_class<>'general' or v_work.status='archived'
    then raise exception 'cloud_marketplace_listing_work_invalid';end if;
  select count(*) into v_count from public.works work
    where work.creator_id=v_profile_id and work.source_project_id=p_project_id;
  if v_count<>1 then raise exception 'cloud_marketplace_listing_work_invalid';end if;

  if v_work.current_publication_id is null
    then raise exception 'cloud_marketplace_listing_publication_required';end if;
  select publication.* into v_publication from public.cloud_work_publications publication
    where publication.id=v_work.current_publication_id and publication.work_id=v_work.id
      and publication.project_id=p_project_id and publication.created_by_profile_id=v_profile_id;
  if v_publication.id is null or v_publication.page_count<1
    then raise exception 'cloud_marketplace_listing_publication_invalid';end if;
  select count(*) into v_count from public.cloud_work_publication_pages page
    where page.publication_id=v_publication.id;
  if v_count<>v_publication.page_count
    or exists(
      select 1 from generate_series(1,v_publication.page_count) expected(page_number)
      where not exists(
        select 1 from public.cloud_work_publication_pages page
        where page.publication_id=v_publication.id
          and page.page_number=expected.page_number
          and nullif(trim(page.storage_path),'') is not null
      )
    ) then raise exception 'cloud_marketplace_listing_pages_invalid';end if;

  select product.* into v_product from public.digital_products product
    where product.creator_id=v_profile_id and product.work_id=v_work.id
    order by product.id limit 1 for update;
  if v_product.id is null or v_product.status='archived'
    or nullif(trim(v_product.file_url),'') is null
    or v_product.file_url<>v_publication.pdf_storage_path or v_product.price<0
    then raise exception 'cloud_marketplace_listing_product_invalid';end if;
  select count(*) into v_count from public.digital_products product
    where product.creator_id=v_profile_id and product.work_id=v_work.id;
  if v_count<>1 then raise exception 'cloud_marketplace_listing_product_invalid';end if;

  if not v_work.is_public or v_work.status<>'published' then
    update public.works set is_public=true,status='published',updated_at=now()
      where id=v_work.id and creator_id=v_profile_id;
  end if;
  if v_product.status<>'active' then
    update public.digital_products set status='active',updated_at=now()
      where id=v_product.id and creator_id=v_profile_id;
  end if;

  return query select v_work.id,v_product.id,v_publication.id;
end$$;

revoke all on function public.publish_cloud_marketplace_listing(uuid) from public,anon;
grant execute on function public.publish_cloud_marketplace_listing(uuid) to authenticated,service_role;

commit;
