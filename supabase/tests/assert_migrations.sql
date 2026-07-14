\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'works'
      and column_name = 'source_project_id'
  ) then
    raise exception 'source_project_id migration missing';
  end if;
  if to_regclass('public.desktop_device_authorizations') is null then
    raise exception 'desktop_device_authorizations migration missing';
  end if;
  if to_regclass('public.desktop_device_rate_limits') is null then
    raise exception 'desktop_device_rate_limits migration missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'works_creator_delete'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'digital_products_creator_delete'
  ) then
    raise exception 'sales package storage delete policies are missing';
  end if;
  if has_function_privilege('anon', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'anon must not execute rate limit function';
  end if;
  if not has_function_privilege('service_role', 'public.consume_desktop_device_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'service_role must execute rate limit function';
  end if;
end $$;

do $$
declare
  v_first boolean;
  v_second boolean;
  v_blocked boolean;
begin
  v_first := public.consume_desktop_device_rate_limit('ci-rate-limit-key-0001', 2, 900);
  v_second := public.consume_desktop_device_rate_limit('ci-rate-limit-key-0001', 2, 900);
  v_blocked := public.consume_desktop_device_rate_limit('ci-rate-limit-key-0001', 2, 900);
  if not v_first or not v_second or v_blocked then
    raise exception 'rate limit behavior is invalid: %, %, %', v_first, v_second, v_blocked;
  end if;
end $$;

insert into public.desktop_device_authorizations (
  device_name,
  secret_hash,
  user_code,
  status,
  expires_at
) values (
  'CI expired device',
  repeat('a', 64),
  'CI23-4567',
  'expired',
  now() - interval '2 days'
);

select public.cleanup_desktop_device_authorizations();

do $$
begin
  if exists (
    select 1 from public.desktop_device_authorizations
    where secret_hash = repeat('a', 64)
  ) then
    raise exception 'expired authorization cleanup failed';
  end if;
end $$;
