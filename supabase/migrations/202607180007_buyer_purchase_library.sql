begin;

alter table public.orders
  add column buyer_profile_id uuid references public.profiles(id) on delete set null,
  add column paid_at timestamptz,
  add column download_count integer not null default 0 check(download_count>=0),
  add column last_download_at timestamptz;

create index orders_buyer_paid_idx on public.orders(buyer_profile_id,paid_at desc)
where buyer_profile_id is not null and status='paid';

alter table public.orders enable row level security;
grant select on public.orders to authenticated;
grant select,update on public.orders to service_role;
create policy "orders_buyer_read" on public.orders for select using(
  buyer_profile_id=public.current_profile_id() and status in('paid','refunded')
);

drop policy if exists "orders_public_pending_insert" on public.orders;
create policy "orders_public_pending_insert" on public.orders
for insert with check (
  status='pending'
  and (buyer_profile_id is null or buyer_profile_id=public.current_profile_id())
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

create or replace function public.record_order_download(
  p_order_id uuid,
  p_buyer_profile_id uuid
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  affected integer;
begin
  update public.orders
  set download_count=download_count+1,
      last_download_at=now()
  where id=p_order_id
    and buyer_profile_id=p_buyer_profile_id
    and status='paid';
  get diagnostics affected=row_count;
  return affected=1;
end;
$$;
revoke all on function public.record_order_download(uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_order_download(uuid,uuid) to service_role;

commit;
