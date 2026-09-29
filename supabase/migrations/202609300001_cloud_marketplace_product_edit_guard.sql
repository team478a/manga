begin;

create or replace function public.enforce_cloud_product_publication_gate()
returns trigger language plpgsql set search_path=public as $$
declare
  v_old_cloud boolean:=false;
  v_new_cloud boolean:=false;
begin
  select exists(
    select 1 from public.works work
    where work.id=new.work_id and work.source_project_id is not null
  ) into v_new_cloud;

  if tg_op='INSERT' then
    if current_user='authenticated' and v_new_cloud then
      raise exception 'cloud_product_creator_managed';
    end if;
  else
    select exists(
      select 1 from public.works work
      where work.id=old.work_id and work.source_project_id is not null
    ) into v_old_cloud;

    if current_user='authenticated' and (v_old_cloud or v_new_cloud) and (
      new.work_id is distinct from old.work_id
      or (to_jsonb(new)->'file_url') is distinct from (to_jsonb(old)->'file_url')
      or new.status is distinct from old.status
      or (old.status='active' and new.price is distinct from old.price)
    ) then
      raise exception 'cloud_product_creator_managed';
    end if;
  end if;

  if new.status='active' and exists(
    select 1 from public.works work
    where work.id=new.work_id and work.source_project_id is not null
      and (work.current_publication_id is null or not work.is_public or work.status<>'published')
  ) then
    raise exception 'cloud_product_publication_required';
  end if;
  return new;
end$$;

drop trigger if exists digital_products_cloud_publication_gate on public.digital_products;
create trigger digital_products_cloud_publication_gate
before insert or update on public.digital_products
for each row execute function public.enforce_cloud_product_publication_gate();

commit;
