begin;

alter table public.orders
  add column if not exists payment_mode text not null default 'live';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_mode_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_mode_check
      check (payment_mode in ('test', 'live'));
  end if;
end
$$;

create index if not exists orders_payment_mode_status_idx
  on public.orders(payment_mode, status);

commit;
