begin;

create or replace function public.enforce_cloud_product_publication_gate()
returns trigger language plpgsql set search_path=public as $$
begin
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
before insert or update of status,work_id on public.digital_products
for each row execute function public.enforce_cloud_product_publication_gate();

commit;
