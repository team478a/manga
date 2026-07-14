begin;

alter table public.works
add column if not exists sample_image_urls text[] not null default '{}';

alter table public.works
add column if not exists source_project_id uuid;

create index if not exists works_source_project_id_idx
on public.works (source_project_id)
where source_project_id is not null;

drop policy if exists "works_creator_delete" on storage.objects;
create policy "works_creator_delete" on storage.objects
for delete using (
  bucket_id = 'works'
  and owner_id = auth.uid()::text
);

drop policy if exists "digital_products_creator_delete" on storage.objects;
create policy "digital_products_creator_delete" on storage.objects
for delete using (
  bucket_id = 'digital-products'
  and owner_id = auth.uid()::text
);

commit;
