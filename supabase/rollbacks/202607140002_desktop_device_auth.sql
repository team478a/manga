begin;

do $$
begin
  if exists (
    select 1 from public.desktop_device_authorizations
    where status = 'approved'
      and token_expires_at > now()
  ) then
    raise exception 'rollback blocked: active Desktop device authorizations exist';
  end if;
end $$;

drop trigger if exists desktop_device_authorizations_touch_updated_at
on public.desktop_device_authorizations;
drop table if exists public.desktop_device_authorizations;

commit;
