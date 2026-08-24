begin;

create table public.cloud_character_reference_bindings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  character_profile_id uuid not null,
  character_version_id uuid not null references public.cloud_character_profile_versions(id) on delete cascade,
  asset_id uuid not null references public.cloud_assets(id) on delete restrict,
  reference_role text not null check(reference_role in('front','side','back','face','full_body','expression','costume_detail')),
  expression_key text not null default '' check(char_length(expression_key)<=80),
  priority integer not null default 0 check(priority between 0 and 100),
  review_status text not null default 'draft' check(review_status in('draft','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(character_profile_id,project_id) references public.cloud_character_profiles(id,project_id) on delete cascade,
  check((reference_role='expression' and char_length(expression_key)>=1) or(reference_role<>'expression' and expression_key='')),
  unique(character_version_id,asset_id,reference_role,expression_key)
);

create index cloud_character_reference_bindings_version_idx on public.cloud_character_reference_bindings(character_version_id,review_status,priority desc,created_at);
alter table public.cloud_character_reference_bindings enable row level security;
grant select on public.cloud_character_reference_bindings to authenticated;
grant select,insert,update,delete on public.cloud_character_reference_bindings to service_role;
create policy "cloud_character_reference_bindings_owner_read" on public.cloud_character_reference_bindings for select using(owner_profile_id=public.current_profile_id());

create or replace function public.save_cloud_character_reference_binding(p_project_id uuid,p_character_profile_id uuid,p_character_version_id uuid,p_asset_id uuid,p_reference_role text,p_expression_key text default null,p_priority integer default 0,p_review_status text default 'draft') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_id uuid;
begin
  if v_owner is null or p_reference_role not in('front','side','back','face','full_body','expression','costume_detail') or p_priority not between 0 and 100 or p_review_status not in('draft','approved','rejected') or ((p_reference_role='expression') is distinct from (nullif(trim(coalesce(p_expression_key,'')),'') is not null)) then raise exception 'cloud_character_reference_binding_invalid';end if;
  if not exists(select 1 from public.cloud_character_profile_versions v join public.cloud_character_profiles p on p.id=v.profile_id and p.project_id=v.project_id where v.id=p_character_version_id and v.profile_id=p_character_profile_id and v.project_id=p_project_id and v.owner_profile_id=v_owner and p.owner_profile_id=v_owner and p.deleted_at is null) or not exists(select 1 from public.cloud_assets a where a.id=p_asset_id and a.project_id=p_project_id and a.owner_profile_id=v_owner and a.deleted_at is null and a.mime_type like 'image/%') then raise exception 'cloud_character_reference_binding_invalid';end if;
  insert into public.cloud_character_reference_bindings(project_id,owner_profile_id,character_profile_id,character_version_id,asset_id,reference_role,expression_key,priority,review_status) values(p_project_id,v_owner,p_character_profile_id,p_character_version_id,p_asset_id,p_reference_role,case when p_reference_role='expression' then trim(p_expression_key) else '' end,p_priority,p_review_status) on conflict(character_version_id,asset_id,reference_role,expression_key) do update set priority=excluded.priority,review_status=excluded.review_status,updated_at=now() returning id into v_id;
  return v_id;
end$$;

create or replace function public.delete_cloud_character_reference_binding(p_project_id uuid,p_binding_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin delete from public.cloud_character_reference_bindings where id=p_binding_id and project_id=p_project_id and owner_profile_id=public.current_profile_id();if not found then raise exception 'cloud_character_reference_binding_not_found';end if;end$$;

comment on table public.cloud_character_reference_bindings is 'Version-specific structured character references. Legacy cloud_visual_reference_assets remain unchanged and are not backfilled because role/version cannot be inferred safely.';
revoke all on function public.save_cloud_character_reference_binding(uuid,uuid,uuid,uuid,text,text,integer,text) from public,anon;
revoke all on function public.delete_cloud_character_reference_binding(uuid,uuid) from public,anon;
grant execute on function public.save_cloud_character_reference_binding(uuid,uuid,uuid,uuid,text,text,integer,text) to authenticated,service_role;
grant execute on function public.delete_cloud_character_reference_binding(uuid,uuid) to authenticated,service_role;
notify pgrst, 'reload schema';
commit;
