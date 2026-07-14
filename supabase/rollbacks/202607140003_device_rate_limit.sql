begin;

revoke execute on function public.consume_desktop_device_rate_limit(text, integer, integer)
from service_role;
revoke execute on function public.cleanup_desktop_device_authorizations()
from service_role;
drop function if exists public.consume_desktop_device_rate_limit(text, integer, integer);
drop function if exists public.cleanup_desktop_device_authorizations();
drop table if exists public.desktop_device_rate_limits;
drop index if exists public.desktop_device_authorizations_expiry_idx;

commit;
