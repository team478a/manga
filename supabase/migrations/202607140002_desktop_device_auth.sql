begin;

create table if not exists public.desktop_device_authorizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  device_name text not null check (char_length(device_name) between 1 and 100),
  secret_hash text not null unique,
  user_code text not null unique,
  scopes text[] not null default array['works:read']::text[],
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'expired', 'revoked')),
  expires_at timestamptz not null,
  token_expires_at timestamptz,
  approved_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists desktop_device_authorizations_profile_idx
on public.desktop_device_authorizations (profile_id, status);

drop trigger if exists desktop_device_authorizations_touch_updated_at
on public.desktop_device_authorizations;
create trigger desktop_device_authorizations_touch_updated_at
before update on public.desktop_device_authorizations
for each row execute function public.touch_updated_at();

alter table public.desktop_device_authorizations enable row level security;

commit;
