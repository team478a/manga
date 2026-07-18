begin;

alter table public.works
add column if not exists content_class text not null default 'adult';

update public.works
set content_class = case
  when tags && array['全年齢','12歳以上','15歳以上']::text[] then 'general'
  else 'adult'
end;

alter table public.works
drop constraint if exists works_content_class_check;

alter table public.works
add constraint works_content_class_check
check (content_class in ('general', 'adult'));

alter table public.works
alter column content_class set default 'general';

create index if not exists works_general_public_idx
on public.works (is_public, status, created_at desc)
where content_class = 'general';

drop policy if exists "works_public_read" on public.works;
create policy "works_public_read" on public.works
for select using (
  (content_class = 'general' and is_public = true)
  or creator_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists "works_creator_insert" on public.works;
create policy "works_creator_insert" on public.works
for insert with check (
  creator_id = public.current_profile_id()
  and content_class = 'general'
);

drop policy if exists "works_creator_update" on public.works;
create policy "works_creator_update" on public.works
for update using (creator_id = public.current_profile_id() or public.is_admin())
with check (
  public.is_admin()
  or (
    creator_id = public.current_profile_id()
    and content_class = 'general'
  )
);

drop policy if exists "products_public_read_active" on public.digital_products;
create policy "products_public_read_active" on public.digital_products
for select using (
  creator_id = public.current_profile_id()
  or public.is_admin()
  or (
    status = 'active'
    and exists (
      select 1 from public.works
      where works.id = digital_products.work_id
        and works.content_class = 'general'
        and works.is_public = true
    )
  )
);

drop policy if exists "products_creator_insert" on public.digital_products;
create policy "products_creator_insert" on public.digital_products
for insert with check (
  creator_id = public.current_profile_id()
  and exists (
    select 1 from public.works
    where works.id = digital_products.work_id
      and works.creator_id = public.current_profile_id()
      and works.content_class = 'general'
  )
);

drop policy if exists "products_creator_update" on public.digital_products;
create policy "products_creator_update" on public.digital_products
for update using (creator_id = public.current_profile_id() or public.is_admin())
with check (
  public.is_admin()
  or (
    creator_id = public.current_profile_id()
    and exists (
      select 1 from public.works
      where works.id = digital_products.work_id
        and works.creator_id = public.current_profile_id()
        and works.content_class = 'general'
    )
  )
);

drop policy if exists "goods_requests_creator_insert" on public.goods_requests;
create policy "goods_requests_creator_insert" on public.goods_requests
for insert with check (
  creator_id = public.current_profile_id()
  and status = 'pending'
  and exists (
    select 1 from public.works
    where works.id = goods_requests.work_id
      and works.creator_id = public.current_profile_id()
      and works.content_class = 'general'
  )
);

drop policy if exists "orders_public_pending_insert" on public.orders;
create policy "orders_public_pending_insert" on public.orders
for insert with check (
  status = 'pending'
  and amount >= 0
  and platform_fee = floor(amount * 0.2)::integer
  and creator_revenue = amount - platform_fee
  and exists (
    select 1
    from public.digital_products
    join public.works on works.id = digital_products.work_id
    where digital_products.id = orders.product_id
      and digital_products.creator_id = orders.creator_id
      and digital_products.price = orders.amount
      and digital_products.status = 'active'
      and works.is_public = true
      and works.content_class = 'general'
  )
);

drop policy if exists "works_creator_upload" on storage.objects;
create policy "works_creator_upload" on storage.objects
for insert with check (
  bucket_id = 'works'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = 'general'
);

drop policy if exists "works_creator_update" on storage.objects;
create policy "works_creator_update" on storage.objects
for update using (
  bucket_id = 'works'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = 'general'
)
with check (
  bucket_id = 'works'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = 'general'
);

commit;
