begin;

do $$
begin
  if exists (
    select 1
    from public.orders
    where payment_mode = 'live'
      and buyer_profile_id is not null
      and status in ('pending', 'paid')
    group by product_id, buyer_profile_id
    having count(*) > 1
  ) then
    raise exception 'marketplace_live_single_purchase_existing_duplicates';
  end if;
end
$$;

create unique index if not exists orders_live_single_purchase_idx
  on public.orders(product_id, buyer_profile_id)
  where payment_mode = 'live'
    and buyer_profile_id is not null
    and status in ('pending', 'paid');

commit;
