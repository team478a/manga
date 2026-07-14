begin;

do $$
begin
  if exists (
    select 1 from public.works
    where source_project_id is not null
       or cardinality(sample_image_urls) > 0
  ) then
    raise exception 'rollback blocked: works contains sales package linkage data';
  end if;
end $$;

drop policy if exists "digital_products_creator_delete" on storage.objects;
drop policy if exists "works_creator_delete" on storage.objects;
drop index if exists public.works_source_project_id_idx;
alter table public.works drop column if exists source_project_id;
alter table public.works drop column if exists sample_image_urls;

commit;
