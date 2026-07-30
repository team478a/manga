begin;

do $$
begin
  if to_regprocedure('vault.create_secret(text,text,text)') is null then
    execute 'create extension if not exists supabase_vault with schema vault';
  end if;
end $$;

alter table public.cloud_market_research_reports
drop constraint if exists cloud_market_research_reports_engine_version_check;
alter table public.cloud_market_research_reports
add constraint cloud_market_research_reports_engine_version_check
check (engine_version in (
  'research-rules-v1',
  'research-rules-v2',
  'openai-web-research-v1',
  'xai-adult-web-research-v1'
));

alter table public.cloud_story_proposal_runs
drop constraint if exists cloud_story_proposal_runs_result_check;
alter table public.cloud_story_proposal_runs
drop constraint if exists cloud_story_proposal_runs_engine_version_check;
alter table public.cloud_story_proposal_runs
add constraint cloud_story_proposal_runs_result_check
check (
  jsonb_typeof(result) = 'object'
  and result->>'engineVersion' in ('openai-proposal-v1', 'xai-adult-proposal-v1')
  and result->>'classification' = 'ai_inference'
  and result->>'containsGeneratedMarketNumbers' = 'false'
  and jsonb_typeof(result->'candidates') = 'array'
  and jsonb_array_length(result->'candidates') = 3
  and pg_column_size(result) <= 131072
);
alter table public.cloud_story_proposal_runs
add constraint cloud_story_proposal_runs_engine_version_check
check (engine_version in ('openai-proposal-v1', 'xai-adult-proposal-v1'));

alter table public.cloud_story_scenario_versions
drop constraint if exists cloud_story_scenario_versions_result_check;
alter table public.cloud_story_scenario_versions
drop constraint if exists cloud_story_scenario_versions_engine_version_check;
alter table public.cloud_story_scenario_versions
add constraint cloud_story_scenario_versions_result_check
check (
  jsonb_typeof(result) = 'object'
  and result->>'engineVersion' in ('openai-scenario-v1', 'xai-adult-scenario-v1')
  and result->>'classification' = 'ai_inference'
  and result->>'containsGeneratedMarketNumbers' = 'false'
  and jsonb_typeof(result->'characters') = 'array'
  and jsonb_typeof(result->'acts') = 'array'
  and jsonb_array_length(result->'acts') = 3
  and jsonb_typeof(result->'scenes') = 'array'
  and jsonb_array_length(result->'scenes') between 6 and 20
  and pg_column_size(result) <= 262144
);
alter table public.cloud_story_scenario_versions
add constraint cloud_story_scenario_versions_engine_version_check
check (engine_version in ('openai-scenario-v1', 'xai-adult-scenario-v1'));

alter table public.cloud_story_storyboard_versions
drop constraint if exists cloud_story_storyboard_versions_result_check;
alter table public.cloud_story_storyboard_versions
drop constraint if exists cloud_story_storyboard_versions_engine_version_check;
alter table public.cloud_story_storyboard_versions
add constraint cloud_story_storyboard_versions_result_check
check (
  jsonb_typeof(result) = 'object'
  and result->>'engineVersion' in ('openai-storyboard-v1', 'xai-adult-storyboard-v1')
  and result->>'classification' = 'ai_inference'
  and result->>'containsGeneratedMarketNumbers' = 'false'
  and result->>'readingDirection' = 'rtl'
  and jsonb_typeof(result->'pages') = 'array'
  and jsonb_array_length(result->'pages') between 8 and 48
  and pg_column_size(result) <= 1048576
);
alter table public.cloud_story_storyboard_versions
add constraint cloud_story_storyboard_versions_engine_version_check
check (engine_version in ('openai-storyboard-v1', 'xai-adult-storyboard-v1'));

create table public.cloud_adult_grok_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  model text not null default 'grok-4.5'
    check (model in ('grok-4.5', 'grok-4.20')),
  secret_id uuid,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.cloud_adult_grok_settings(singleton, enabled, model)
values (true, false, 'grok-4.5');

create table public.cloud_adult_grok_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('configure', 'replace_key', 'enable', 'disable')),
  model text not null check (model in ('grok-4.5', 'grok-4.20')),
  enabled boolean not null,
  created_at timestamptz not null default now()
);
create index cloud_adult_grok_audit_created_idx
on public.cloud_adult_grok_audit_logs(created_at desc);

alter table public.cloud_adult_grok_settings enable row level security;
alter table public.cloud_adult_grok_audit_logs enable row level security;
grant select on public.cloud_adult_grok_settings to authenticated;
grant select on public.cloud_adult_grok_audit_logs to authenticated;
grant select, insert, update, delete on public.cloud_adult_grok_settings to service_role;
grant select, insert on public.cloud_adult_grok_audit_logs to service_role;
create policy "cloud_adult_grok_settings_admin_read"
on public.cloud_adult_grok_settings for select using (public.is_admin());
create policy "cloud_adult_grok_audit_admin_read"
on public.cloud_adult_grok_audit_logs for select using (public.is_admin());

create or replace function public.set_cloud_adult_grok_provider(
  p_actor_profile_id uuid,
  p_api_key text,
  p_model text,
  p_enabled boolean
) returns void language plpgsql security definer set search_path = public, vault as $$
declare
  v_settings public.cloud_adult_grok_settings%rowtype;
  v_secret_id uuid;
  v_action text;
  v_api_key text := nullif(btrim(coalesce(p_api_key, '')), '');
begin
  if auth.role() <> 'service_role' or not exists (
    select 1 from public.profiles
    where id = p_actor_profile_id and role = 'admin'
  ) then raise exception 'cloud_adult_grok_admin_required'; end if;
  if p_model not in ('grok-4.5', 'grok-4.20') then
    raise exception 'cloud_adult_grok_model_invalid';
  end if;
  if v_api_key is not null and (
    char_length(v_api_key) < 20 or char_length(v_api_key) > 500 or v_api_key ~ '\s'
  ) then raise exception 'cloud_adult_grok_key_invalid'; end if;

  select * into v_settings from public.cloud_adult_grok_settings
  where singleton = true for update;
  v_secret_id := v_settings.secret_id;
  if v_api_key is not null then
    if v_secret_id is null then
      v_secret_id := vault.create_secret(
        v_api_key,
        'mangai_cloud_adult_xai',
        'MANGAI Cloud adult text xAI API key'
      );
      v_action := 'configure';
    else
      perform vault.update_secret(
        v_secret_id,
        v_api_key,
        'mangai_cloud_adult_xai',
        'MANGAI Cloud adult text xAI API key'
      );
      v_action := 'replace_key';
    end if;
  elsif p_enabled and v_secret_id is null then
    raise exception 'cloud_adult_grok_key_required';
  else
    v_action := case when p_enabled then 'enable' else 'disable' end;
  end if;

  update public.cloud_adult_grok_settings
  set enabled = p_enabled,
      model = p_model,
      secret_id = v_secret_id,
      updated_by_profile_id = p_actor_profile_id,
      updated_at = now()
  where singleton = true;
  insert into public.cloud_adult_grok_audit_logs(actor_profile_id, action, model, enabled)
  values (p_actor_profile_id, v_action, p_model, p_enabled);
end;
$$;

create or replace function public.get_cloud_adult_grok_runtime_config()
returns table(enabled boolean, model text, api_key text)
language plpgsql security definer set search_path = public, vault as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'cloud_adult_grok_service_role_required';
  end if;
  return query
  select settings.enabled, settings.model, secrets.decrypted_secret
  from public.cloud_adult_grok_settings settings
  left join vault.decrypted_secrets secrets on secrets.id = settings.secret_id
  where settings.singleton = true;
end;
$$;

revoke all on function public.set_cloud_adult_grok_provider(uuid,text,text,boolean)
from public, anon, authenticated;
revoke all on function public.get_cloud_adult_grok_runtime_config()
from public, anon, authenticated;
grant execute on function public.set_cloud_adult_grok_provider(uuid,text,text,boolean)
to service_role;
grant execute on function public.get_cloud_adult_grok_runtime_config()
to service_role;

commit;
