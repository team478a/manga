begin;

do $$
begin
  if to_regprocedure('vault.create_secret(text,text,text)') is null then
    execute 'create extension if not exists supabase_vault with schema vault';
  end if;
end $$;

create table if not exists public.cloud_general_image_provider_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  model text not null default 'flux-2-pro' check (
    model in ('flux-2-klein-9b', 'flux-2-pro', 'flux-2-max')
  ),
  secret_id uuid,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.cloud_general_image_provider_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.cloud_general_image_provider_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (
    action in ('configure', 'replace_key', 'enable', 'disable')
  ),
  model text not null check (
    model in ('flux-2-klein-9b', 'flux-2-pro', 'flux-2-max')
  ),
  enabled boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists cloud_general_image_provider_audit_created_idx
on public.cloud_general_image_provider_audit_logs(created_at desc);

alter table public.cloud_general_image_provider_settings enable row level security;
alter table public.cloud_general_image_provider_audit_logs enable row level security;

grant select on public.cloud_general_image_provider_settings to authenticated;
grant select on public.cloud_general_image_provider_audit_logs to authenticated;
grant select, insert, update, delete
on public.cloud_general_image_provider_settings to service_role;
grant select, insert
on public.cloud_general_image_provider_audit_logs to service_role;

drop policy if exists "cloud_general_image_provider_settings_admin_read"
on public.cloud_general_image_provider_settings;
create policy "cloud_general_image_provider_settings_admin_read"
on public.cloud_general_image_provider_settings
for select
using (public.is_admin());

drop policy if exists "cloud_general_image_provider_audit_admin_read"
on public.cloud_general_image_provider_audit_logs;
create policy "cloud_general_image_provider_audit_admin_read"
on public.cloud_general_image_provider_audit_logs
for select
using (public.is_admin());

create or replace function public.set_cloud_general_image_provider(
  p_actor_profile_id uuid,
  p_api_key text,
  p_model text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_settings public.cloud_general_image_provider_settings%rowtype;
  v_secret_id uuid;
  v_action text;
  v_api_key text := nullif(btrim(coalesce(p_api_key, '')), '');
begin
  if auth.role() <> 'service_role'
     or not exists (
       select 1 from public.profiles
       where id = p_actor_profile_id and role = 'admin'
     ) then
    raise exception 'cloud_general_image_provider_admin_required';
  end if;
  if p_model not in ('flux-2-klein-9b', 'flux-2-pro', 'flux-2-max') then
    raise exception 'cloud_general_image_provider_model_invalid';
  end if;
  if v_api_key is not null
     and (
       char_length(v_api_key) < 20
       or char_length(v_api_key) > 500
       or v_api_key ~ '[[:space:]]'
     ) then
    raise exception 'cloud_general_image_provider_key_invalid';
  end if;

  select *
  into v_settings
  from public.cloud_general_image_provider_settings
  where singleton = true
  for update;

  v_secret_id := v_settings.secret_id;
  if v_api_key is not null then
    if v_secret_id is null then
      v_secret_id := vault.create_secret(
        v_api_key,
        'mangai_cloud_general_bfl',
        'MANGAI Cloud general image Black Forest Labs API key'
      );
      v_action := 'configure';
    else
      perform vault.update_secret(
        v_secret_id,
        v_api_key,
        'mangai_cloud_general_bfl',
        'MANGAI Cloud general image Black Forest Labs API key'
      );
      v_action := 'replace_key';
    end if;
  elsif p_enabled and v_secret_id is null then
    raise exception 'cloud_general_image_provider_key_required';
  else
    v_action := case when p_enabled then 'enable' else 'disable' end;
  end if;

  update public.cloud_general_image_provider_settings
  set enabled = p_enabled,
      model = p_model,
      secret_id = v_secret_id,
      updated_by_profile_id = p_actor_profile_id,
      updated_at = now()
  where singleton = true;

  insert into public.cloud_general_image_provider_audit_logs (
    actor_profile_id, action, model, enabled
  ) values (
    p_actor_profile_id, v_action, p_model, p_enabled
  );
end;
$$;

create or replace function public.get_cloud_general_image_runtime_config()
returns table (
  enabled boolean,
  model text,
  api_key text
)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'cloud_general_image_provider_service_role_required';
  end if;
  return query
  select settings.enabled, settings.model, secrets.decrypted_secret
  from public.cloud_general_image_provider_settings settings
  left join vault.decrypted_secrets secrets on secrets.id = settings.secret_id
  where settings.singleton = true;
end;
$$;

revoke all on function public.set_cloud_general_image_provider(
  uuid, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.get_cloud_general_image_runtime_config()
from public, anon, authenticated;
grant execute on function public.set_cloud_general_image_provider(
  uuid, text, text, boolean
) to service_role;
grant execute on function public.get_cloud_general_image_runtime_config()
to service_role;

insert into public.cloud_ai_provider_prices (
  provider_id,
  model_id,
  kind,
  job_type,
  pricing_version,
  credits,
  max_cost_micros,
  currency,
  active
)
select
  'black-forest-labs',
  model_id,
  'image',
  job_type,
  'bfl-flux2-2026-03',
  credits,
  max_cost_micros,
  'USD',
  true
from (
  values
    ('flux-2-klein-9b', 1, 15000),
    ('flux-2-pro', 2, 30000),
    ('flux-2-max', 4, 70000)
) models(model_id, credits, max_cost_micros)
cross join (
  values ('background'), ('prop'), ('effect'), ('character_base')
) jobs(job_type)
on conflict (provider_id, model_id, job_type, pricing_version)
do update set
  credits = excluded.credits,
  max_cost_micros = excluded.max_cost_micros,
  currency = excluded.currency,
  active = excluded.active,
  updated_at = now();

commit;
