begin;

drop function if exists public.record_order_download(uuid,uuid);
drop policy if exists "orders_buyer_read" on public.orders;
drop policy if exists "orders_public_pending_insert" on public.orders;
create policy "orders_public_pending_insert" on public.orders
for insert with check (
  status='pending'
  and amount>=0
  and platform_fee=floor(amount*0.2)::integer
  and creator_revenue=amount-platform_fee
  and exists (
    select 1 from public.digital_products
    join public.works on works.id=digital_products.work_id
    where digital_products.id=orders.product_id
      and digital_products.creator_id=orders.creator_id
      and digital_products.price=orders.amount
      and digital_products.status='active'
      and works.is_public=true
      and works.content_class='general'
  )
);
drop index if exists public.orders_buyer_paid_idx;
alter table public.orders
  drop column last_download_at,
  drop column download_count,
  drop column paid_at,
  drop column buyer_profile_id;

commit;
