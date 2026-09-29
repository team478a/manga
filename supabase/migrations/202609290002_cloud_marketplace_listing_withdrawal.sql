begin;

create or replace function public.withdraw_cloud_marketplace_listing(p_project_id uuid)
returns table(work_id uuid,product_id uuid,publication_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_work public.works%rowtype;
  v_product public.digital_products%rowtype;
  v_count integer;
begin
  if v_profile_id is null then raise exception 'cloud_marketplace_withdrawal_auth_required';end if;
  if p_project_id is null then raise exception 'cloud_marketplace_withdrawal_input_invalid';end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));

  select work.* into v_work from public.works work
    where work.creator_id=v_profile_id and work.source_project_id=p_project_id
    order by work.id limit 1 for update;
  if v_work.id is null or v_work.content_class<>'general' or v_work.status='archived'
    or v_work.current_publication_id is null
    then raise exception 'cloud_marketplace_withdrawal_work_invalid';end if;
  select count(*) into v_count from public.works work
    where work.creator_id=v_profile_id and work.source_project_id=p_project_id;
  if v_count<>1 then raise exception 'cloud_marketplace_withdrawal_work_invalid';end if;

  select product.* into v_product from public.digital_products product
    where product.creator_id=v_profile_id and product.work_id=v_work.id
    order by product.id limit 1 for update;
  if v_product.id is null or v_product.status='archived'
    then raise exception 'cloud_marketplace_withdrawal_product_invalid';end if;
  select count(*) into v_count from public.digital_products product
    where product.creator_id=v_profile_id and product.work_id=v_work.id;
  if v_count<>1 then raise exception 'cloud_marketplace_withdrawal_product_invalid';end if;

  if v_product.status<>'paused' then
    update public.digital_products set status='paused',updated_at=now()
      where id=v_product.id and creator_id=v_profile_id;
  end if;
  if v_work.is_public or v_work.status<>'draft' then
    update public.works set is_public=false,status='draft',updated_at=now()
      where id=v_work.id and creator_id=v_profile_id;
  end if;

  return query select v_work.id,v_product.id,v_work.current_publication_id;
end$$;

revoke all on function public.withdraw_cloud_marketplace_listing(uuid) from public,anon;
grant execute on function public.withdraw_cloud_marketplace_listing(uuid) to authenticated,service_role;

commit;
