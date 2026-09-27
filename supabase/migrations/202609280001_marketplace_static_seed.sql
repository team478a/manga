begin;

-- Supabase Preview Branches clone the database schema, but static rows in
-- public tables and Storage configuration can be absent. Keep the canonical
-- Marketplace prerequisites idempotent so an isolated branch can create
-- profiles, upload work images, and upload private sale files.
insert into public.cloud_ai_plans(
  plan_key,
  display_name,
  monthly_credits,
  monthly_cost_limit_micros,
  user_requests_per_minute,
  project_requests_per_minute
) values
  ('free','Free',20,2000000,5,3),
  ('trial','Trial',100,10000000,10,6),
  ('creator','Creator',1000,100000000,30,20)
on conflict (plan_key) do nothing;

insert into public.cloud_ai_settings(singleton)
values(true)
on conflict (singleton) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'works',
  'works',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'digital-products',
  'digital-products',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed'
  ]::text[]
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "works_public_read" on storage.objects;
create policy "works_public_read" on storage.objects
for select using (bucket_id='works');

drop policy if exists "works_creator_upload" on storage.objects;
create policy "works_creator_upload" on storage.objects
for insert with check (
  bucket_id='works'
  and auth.role()='authenticated'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "works_creator_update" on storage.objects;
create policy "works_creator_update" on storage.objects
for update using (
  bucket_id='works'
  and owner_id=auth.uid()::text
)
with check (
  bucket_id='works'
  and owner_id=auth.uid()::text
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or (storage.foldername(name))[1]='general'
  )
);

drop policy if exists "works_creator_delete" on storage.objects;
create policy "works_creator_delete" on storage.objects
for delete using (
  bucket_id='works'
  and owner_id=auth.uid()::text
);

drop policy if exists "digital_products_creator_upload" on storage.objects;
create policy "digital_products_creator_upload" on storage.objects
for insert with check (
  bucket_id='digital-products'
  and auth.role()='authenticated'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "digital_products_creator_update" on storage.objects;
create policy "digital_products_creator_update" on storage.objects
for update using (
  bucket_id='digital-products'
  and owner_id=auth.uid()::text
)
with check (
  bucket_id='digital-products'
  and owner_id=auth.uid()::text
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or (storage.foldername(name))[1]='general'
  )
);

drop policy if exists "digital_products_creator_delete" on storage.objects;
create policy "digital_products_creator_delete" on storage.objects
for delete using (
  bucket_id='digital-products'
  and owner_id=auth.uid()::text
);

commit;
