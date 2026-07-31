begin;

do $$
begin
  if to_regprocedure('vault.create_secret(text,text,text)') is null then
    execute 'create extension if not exists supabase_vault with schema vault';
  end if;
end
$$;

create table public.cloud_general_monitor_email_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  from_email text not null default '',
  from_name text not null default 'MANGAI運営',
  secret_id uuid,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (char_length(from_email) <= 254),
  check (char_length(from_name) between 1 and 80)
);

insert into public.cloud_general_monitor_email_settings(
  singleton, enabled, from_email, from_name
) values(true, false, '', 'MANGAI運営');

create table public.cloud_general_monitor_email_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  action text not null check (action in ('configure','replace_key')),
  from_email text not null,
  created_at timestamptz not null default now()
);

alter table public.cloud_general_monitor_email_settings enable row level security;
alter table public.cloud_general_monitor_email_audit_logs enable row level security;

grant select on public.cloud_general_monitor_email_settings,
  public.cloud_general_monitor_email_audit_logs to authenticated;
grant select,insert,update,delete
  on public.cloud_general_monitor_email_settings to service_role;
grant select,insert on public.cloud_general_monitor_email_audit_logs
  to service_role;

create policy "cloud_general_monitor_email_settings_admin_read"
on public.cloud_general_monitor_email_settings
for select using (public.is_admin());

create policy "cloud_general_monitor_email_audit_admin_read"
on public.cloud_general_monitor_email_audit_logs
for select using (public.is_admin());

create or replace function public.set_cloud_general_monitor_email_provider(
  p_actor_profile_id uuid,
  p_api_key text,
  p_from_email text,
  p_from_name text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path=public,vault
as $$
declare
  v_settings public.cloud_general_monitor_email_settings%rowtype;
  v_secret_id uuid;
  v_api_key text:=nullif(btrim(coalesce(p_api_key,'')),'');
  v_from_email text:=lower(btrim(coalesce(p_from_email,'')));
  v_from_name text:=btrim(coalesce(p_from_name,''));
  v_action text;
begin
  if auth.role()<>'service_role' or not exists (
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then
    raise exception 'cloud_general_monitor_email_admin_required';
  end if;
  if v_api_key is null
    or char_length(v_api_key)<20
    or char_length(v_api_key)>500
    or v_api_key!~'^re_[^[:space:]]+$'
    or char_length(v_from_email)>254
    or v_from_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(v_from_name) not between 1 and 80
  then
    raise exception 'cloud_general_monitor_email_input_invalid';
  end if;

  select * into v_settings
  from public.cloud_general_monitor_email_settings
  where singleton=true
  for update;
  v_secret_id:=v_settings.secret_id;
  if v_secret_id is null then
    v_secret_id:=vault.create_secret(
      v_api_key,
      'mangai_general_monitor_resend',
      'MANGAI general monitor Resend API key'
    );
    v_action:='configure';
  else
    perform vault.update_secret(
      v_secret_id,
      v_api_key,
      'mangai_general_monitor_resend',
      'MANGAI general monitor Resend API key'
    );
    v_action:='replace_key';
  end if;

  update public.cloud_general_monitor_email_settings
  set enabled=p_enabled,
      from_email=v_from_email,
      from_name=v_from_name,
      secret_id=v_secret_id,
      updated_by_profile_id=p_actor_profile_id,
      updated_at=now()
  where singleton=true;

  insert into public.cloud_general_monitor_email_audit_logs(
    actor_profile_id,action,from_email
  ) values(p_actor_profile_id,v_action,v_from_email);
end
$$;

create or replace function public.get_cloud_general_monitor_email_runtime_config()
returns table(
  enabled boolean,
  api_key text,
  from_email text,
  from_name text
)
language plpgsql
security definer
set search_path=public,vault
as $$
begin
  if auth.role()<>'service_role' then
    raise exception 'cloud_general_monitor_email_service_required';
  end if;
  return query
  select settings.enabled,
    secrets.decrypted_secret,
    settings.from_email,
    settings.from_name
  from public.cloud_general_monitor_email_settings settings
  left join vault.decrypted_secrets secrets on secrets.id=settings.secret_id
  where settings.singleton=true;
end
$$;

revoke all on function public.set_cloud_general_monitor_email_provider(
  uuid,text,text,text,boolean
) from public,anon,authenticated;
revoke all on function public.get_cloud_general_monitor_email_runtime_config()
from public,anon,authenticated;
grant execute on function public.set_cloud_general_monitor_email_provider(
  uuid,text,text,text,boolean
) to service_role;
grant execute on function public.get_cloud_general_monitor_email_runtime_config()
to service_role;

commit;
