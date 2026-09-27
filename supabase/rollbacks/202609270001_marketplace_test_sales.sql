begin;

do $$
begin
  if exists (
    select 1
    from public.orders
    where payment_mode = 'test'
  ) then
    raise exception 'marketplace_test_sales_rollback_blocked';
  end if;
end
$$;

drop index if exists public.orders_payment_mode_status_idx;
alter table public.orders drop constraint if exists orders_payment_mode_check;
alter table public.orders drop column if exists payment_mode;

commit;
