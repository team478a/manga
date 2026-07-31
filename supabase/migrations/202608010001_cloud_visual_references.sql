begin;

create table public.cloud_visual_reference_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('character','style','location','prop')),
  subject_id uuid not null,
  asset_id uuid not null references public.cloud_assets(id) on delete cascade,
  label text not null default '' check (char_length(label) <= 120),
  created_at timestamptz not null default now(),
  unique (project_id, subject_kind, subject_id, asset_id)
);

create index cloud_visual_reference_subject_idx
  on public.cloud_visual_reference_assets(project_id, subject_kind, subject_id, created_at);

create table public.cloud_panel_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  page_id uuid not null references public.cloud_pages(id) on delete cascade,
  panel_id uuid not null,
  subject_kind text not null check (subject_kind in ('character','location','prop')),
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  unique (project_id, page_id, panel_id, subject_kind, subject_id)
);

create index cloud_panel_subject_assignment_panel_idx
  on public.cloud_panel_subject_assignments(project_id, page_id, panel_id);

alter table public.cloud_visual_reference_assets enable row level security;
alter table public.cloud_panel_subject_assignments enable row level security;
grant select on public.cloud_visual_reference_assets, public.cloud_panel_subject_assignments to authenticated;
grant select, insert, update, delete on public.cloud_visual_reference_assets, public.cloud_panel_subject_assignments to service_role;

create policy "cloud_visual_reference_owner_read"
  on public.cloud_visual_reference_assets for select
  using (owner_profile_id = public.current_profile_id());
create policy "cloud_panel_subject_assignment_owner_read"
  on public.cloud_panel_subject_assignments for select
  using (owner_profile_id = public.current_profile_id());

create or replace function public.cloud_visual_subject_exists(
  p_project_id uuid,
  p_subject_kind text,
  p_subject_id uuid,
  p_owner_profile_id uuid
) returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$
  select case p_subject_kind
    when 'character' then exists (
      select 1 from public.cloud_character_profiles
      where id=p_subject_id and project_id=p_project_id
        and owner_profile_id=p_owner_profile_id and deleted_at is null
    )
    when 'style' then exists (
      select 1 from public.cloud_style_bibles
      where id=p_subject_id and project_id=p_project_id
        and owner_profile_id=p_owner_profile_id
    )
    when 'location' then exists (
      select 1 from public.cloud_world_profiles
      where id=p_subject_id and project_id=p_project_id
        and owner_profile_id=p_owner_profile_id and kind='location' and deleted_at is null
    )
    when 'prop' then exists (
      select 1 from public.cloud_world_profiles
      where id=p_subject_id and project_id=p_project_id
        and owner_profile_id=p_owner_profile_id and kind='prop' and deleted_at is null
    )
    else false
  end;
$$;

create or replace function public.save_cloud_visual_reference(
  p_project_id uuid,
  p_subject_kind text,
  p_subject_id uuid,
  p_asset_id uuid,
  p_label text
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_owner uuid := public.current_profile_id();
  v_id uuid;
begin
  if v_owner is null
    or p_subject_kind not in ('character','style','location','prop')
    or char_length(coalesce(p_label,'')) > 120
    or not public.cloud_visual_subject_exists(p_project_id,p_subject_kind,p_subject_id,v_owner)
    or not exists (
      select 1 from public.cloud_assets
      where id=p_asset_id and project_id=p_project_id
        and owner_profile_id=v_owner and deleted_at is null
    ) then
    raise exception 'cloud_visual_reference_invalid';
  end if;
  insert into public.cloud_visual_reference_assets(
    project_id,owner_profile_id,subject_kind,subject_id,asset_id,label
  ) values (
    p_project_id,v_owner,p_subject_kind,p_subject_id,p_asset_id,trim(coalesce(p_label,''))
  ) on conflict(project_id,subject_kind,subject_id,asset_id)
    do update set label=excluded.label
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_cloud_visual_reference(
  p_project_id uuid,
  p_reference_id uuid
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  delete from public.cloud_visual_reference_assets
  where id=p_reference_id and project_id=p_project_id
    and owner_profile_id=public.current_profile_id();
  if not found then raise exception 'cloud_visual_reference_not_found'; end if;
end;
$$;

create or replace function public.save_cloud_panel_subject_assignment(
  p_project_id uuid,
  p_page_id uuid,
  p_panel_id uuid,
  p_subject_kind text,
  p_subject_id uuid
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_owner uuid := public.current_profile_id();
  v_id uuid;
begin
  if v_owner is null
    or p_subject_kind not in ('character','location','prop')
    or not public.cloud_visual_subject_exists(p_project_id,p_subject_kind,p_subject_id,v_owner)
    or not exists (
      select 1 from public.cloud_pages page
      join public.cloud_projects project on project.id=page.project_id
      where page.id=p_page_id and page.project_id=p_project_id
        and page.deleted_at is null and project.owner_profile_id=v_owner
        and project.content_class='general' and project.deleted_at is null
    ) then
    raise exception 'cloud_panel_subject_assignment_invalid';
  end if;
  insert into public.cloud_panel_subject_assignments(
    project_id,owner_profile_id,page_id,panel_id,subject_kind,subject_id
  ) values (p_project_id,v_owner,p_page_id,p_panel_id,p_subject_kind,p_subject_id)
  on conflict(project_id,page_id,panel_id,subject_kind,subject_id)
    do update set owner_profile_id=excluded.owner_profile_id
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_cloud_panel_subject_assignment(
  p_project_id uuid,
  p_assignment_id uuid
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  delete from public.cloud_panel_subject_assignments
  where id=p_assignment_id and project_id=p_project_id
    and owner_profile_id=public.current_profile_id();
  if not found then raise exception 'cloud_panel_subject_assignment_not_found'; end if;
end;
$$;

revoke all on function public.cloud_visual_subject_exists(uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_cloud_visual_reference(uuid,text,uuid,uuid,text) from public,anon;
revoke all on function public.delete_cloud_visual_reference(uuid,uuid) from public,anon;
revoke all on function public.save_cloud_panel_subject_assignment(uuid,uuid,uuid,text,uuid) from public,anon;
revoke all on function public.delete_cloud_panel_subject_assignment(uuid,uuid) from public,anon;
grant execute on function public.save_cloud_visual_reference(uuid,text,uuid,uuid,text) to authenticated,service_role;
grant execute on function public.delete_cloud_visual_reference(uuid,uuid) to authenticated,service_role;
grant execute on function public.save_cloud_panel_subject_assignment(uuid,uuid,uuid,text,uuid) to authenticated,service_role;
grant execute on function public.delete_cloud_panel_subject_assignment(uuid,uuid) to authenticated,service_role;

commit;
