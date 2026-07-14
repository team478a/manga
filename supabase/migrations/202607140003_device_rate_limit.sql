begin;

create index if not exists desktop_device_authorizations_expiry_idx
on public.desktop_device_authorizations (status, expires_at);

create table if not exists public.desktop_device_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_desktop_device_rate_limit(
  p_key_hash text,
  p_request_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.desktop_device_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if char_length(p_key_hash) < 16 or p_request_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid desktop device rate limit input';
  end if;

  insert into public.desktop_device_rate_limits (key_hash, request_count, window_started_at, updated_at)
  values (p_key_hash, 0, v_now, v_now)
  on conflict (key_hash) do nothing;

  select * into v_row
  from public.desktop_device_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return false;
  end if;

  if v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) then
    update public.desktop_device_rate_limits
    set window_started_at = v_now,
        request_count = 1,
        blocked_until = null,
        updated_at = v_now
    where key_hash = p_key_hash;
    return true;
  end if;

  if v_row.request_count >= p_request_limit then
    update public.desktop_device_rate_limits
    set blocked_until = v_now + make_interval(secs => p_window_seconds),
        updated_at = v_now
    where key_hash = p_key_hash;
    return false;
  end if;

  update public.desktop_device_rate_limits
  set request_count = request_count + 1,
      updated_at = v_now
  where key_hash = p_key_hash;
  return true;
end;
$$;

create or replace function public.cleanup_desktop_device_authorizations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.desktop_device_authorizations
  where (
    status in ('pending', 'denied', 'expired')
    and expires_at < now() - interval '1 day'
  ) or (
    status = 'revoked'
    and coalesce(revoked_at, updated_at) < now() - interval '30 days'
  ) or (
    status = 'approved'
    and token_expires_at < now() - interval '30 days'
  );
  get diagnostics v_deleted = row_count;

  delete from public.desktop_device_rate_limits
  where updated_at < now() - interval '1 day';

  return v_deleted;
end;
$$;

revoke execute on function public.consume_desktop_device_rate_limit(text, integer, integer)
from public, anon, authenticated;
grant execute on function public.consume_desktop_device_rate_limit(text, integer, integer)
to service_role;
revoke execute on function public.cleanup_desktop_device_authorizations()
from public, anon, authenticated;
grant execute on function public.cleanup_desktop_device_authorizations()
to service_role;

alter table public.desktop_device_rate_limits enable row level security;

commit;
