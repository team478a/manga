begin;

create table public.cloud_style_bibles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  current_version integer not null default 1 check (current_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);

create table public.cloud_style_bible_versions (
  id uuid primary key default gen_random_uuid(),
  bible_id uuid not null,
  project_id uuid not null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  art_style text not null default '' check (char_length(art_style) <= 500),
  linework text not null default '' check (char_length(linework) <= 500),
  shading text not null default '' check (char_length(shading) <= 500),
  background_detail text not null default '' check (char_length(background_detail) <= 500),
  composition_rules text not null default '' check (char_length(composition_rules) <= 1000),
  negative_prompt text not null default '' check (char_length(negative_prompt) <= 1500),
  created_at timestamptz not null default now(),
  unique (bible_id, version_number),
  foreign key (bible_id, project_id)
    references public.cloud_style_bibles(id, project_id) on delete cascade
);

create index cloud_style_bible_versions_bible_idx
  on public.cloud_style_bible_versions(bible_id, version_number desc);

create table public.cloud_world_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('location', 'prop')),
  name text not null check (char_length(name) between 1 and 100),
  current_version integer not null default 1 check (current_version >= 1),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);

create index cloud_world_profiles_project_idx
  on public.cloud_world_profiles(project_id, kind, updated_at desc)
  where deleted_at is null;

create table public.cloud_world_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  project_id uuid not null,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  description text not null default '' check (char_length(description) <= 1000),
  visual_traits text[] not null default '{}' check (cardinality(visual_traits) <= 12),
  color_palette text not null default '' check (char_length(color_palette) <= 300),
  continuity_rules text[] not null default '{}' check (cardinality(continuity_rules) <= 12),
  prompt text not null default '' check (char_length(prompt) <= 3000),
  negative_prompt text not null default '' check (char_length(negative_prompt) <= 1500),
  created_at timestamptz not null default now(),
  unique (profile_id, version_number),
  foreign key (profile_id, project_id)
    references public.cloud_world_profiles(id, project_id) on delete cascade
);

create index cloud_world_profile_versions_profile_idx
  on public.cloud_world_profile_versions(profile_id, version_number desc);

alter table public.cloud_style_bibles enable row level security;
alter table public.cloud_style_bible_versions enable row level security;
alter table public.cloud_world_profiles enable row level security;
alter table public.cloud_world_profile_versions enable row level security;

grant select on public.cloud_style_bibles, public.cloud_style_bible_versions,
  public.cloud_world_profiles, public.cloud_world_profile_versions to authenticated;
grant select, insert, update, delete on public.cloud_style_bibles,
  public.cloud_style_bible_versions, public.cloud_world_profiles,
  public.cloud_world_profile_versions to service_role;

create policy "cloud_style_bibles_owner_read" on public.cloud_style_bibles
  for select using (owner_profile_id = public.current_profile_id());
create policy "cloud_style_bible_versions_owner_read" on public.cloud_style_bible_versions
  for select using (owner_profile_id = public.current_profile_id());
create policy "cloud_world_profiles_owner_read" on public.cloud_world_profiles
  for select using (owner_profile_id = public.current_profile_id());
create policy "cloud_world_profile_versions_owner_read" on public.cloud_world_profile_versions
  for select using (owner_profile_id = public.current_profile_id());

create or replace function public.save_cloud_style_bible(
  p_project_id uuid,
  p_art_style text,
  p_linework text,
  p_shading text,
  p_background_detail text,
  p_composition_rules text,
  p_negative_prompt text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid := public.current_profile_id();
  v_id uuid;
  v_version integer;
begin
  if v_owner is null or not exists (
    select 1 from public.cloud_projects
    where id = p_project_id and owner_profile_id = v_owner
      and content_class = 'general' and deleted_at is null
  ) then raise exception 'cloud_style_project_not_found'; end if;
  if char_length(coalesce(p_art_style, '')) > 500
    or char_length(coalesce(p_linework, '')) > 500
    or char_length(coalesce(p_shading, '')) > 500
    or char_length(coalesce(p_background_detail, '')) > 500
    or char_length(coalesce(p_composition_rules, '')) > 1000
    or char_length(coalesce(p_negative_prompt, '')) > 1500
  then raise exception 'cloud_style_input_invalid'; end if;
  select id, current_version + 1 into v_id, v_version
    from public.cloud_style_bibles
    where project_id = p_project_id and owner_profile_id = v_owner for update;
  if found then
    update public.cloud_style_bibles set current_version = v_version, updated_at = now()
      where id = v_id;
  else
    v_id := gen_random_uuid(); v_version := 1;
    insert into public.cloud_style_bibles(id, project_id, owner_profile_id, current_version)
      values (v_id, p_project_id, v_owner, v_version);
  end if;
  insert into public.cloud_style_bible_versions(
    bible_id, project_id, owner_profile_id, version_number, art_style,
    linework, shading, background_detail, composition_rules, negative_prompt
  ) values (
    v_id, p_project_id, v_owner, v_version, trim(coalesce(p_art_style, '')),
    trim(coalesce(p_linework, '')), trim(coalesce(p_shading, '')),
    trim(coalesce(p_background_detail, '')), trim(coalesce(p_composition_rules, '')),
    trim(coalesce(p_negative_prompt, ''))
  );
  return v_id;
end $$;

create or replace function public.save_cloud_world_profile(
  p_project_id uuid, p_profile_id uuid, p_kind text, p_name text,
  p_description text, p_visual_traits text[], p_color_palette text,
  p_continuity_rules text[], p_prompt text, p_negative_prompt text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid := public.current_profile_id();
  v_id uuid := coalesce(p_profile_id, gen_random_uuid());
  v_version integer;
  v_traits text[] := coalesce(p_visual_traits, '{}');
  v_rules text[] := coalesce(p_continuity_rules, '{}');
begin
  if v_owner is null or not exists (
    select 1 from public.cloud_projects
    where id = p_project_id and owner_profile_id = v_owner
      and content_class = 'general' and deleted_at is null
  ) then raise exception 'cloud_world_project_not_found'; end if;
  if p_kind not in ('location', 'prop')
    or char_length(trim(coalesce(p_name, ''))) not between 1 and 100
    or char_length(coalesce(p_description, '')) > 1000
    or cardinality(v_traits) > 12 or cardinality(v_rules) > 12
    or exists (select 1 from unnest(v_traits || v_rules) value
      where char_length(trim(value)) not between 1 and 120)
    or char_length(coalesce(p_color_palette, '')) > 300
    or char_length(coalesce(p_prompt, '')) > 3000
    or char_length(coalesce(p_negative_prompt, '')) > 1500
  then raise exception 'cloud_world_input_invalid'; end if;
  select current_version + 1 into v_version from public.cloud_world_profiles
    where id = v_id and project_id = p_project_id and owner_profile_id = v_owner
    for update;
  if found then
    update public.cloud_world_profiles set kind = p_kind, name = trim(p_name),
      current_version = v_version, deleted_at = null, updated_at = now()
      where id = v_id;
  else
    v_version := 1;
    insert into public.cloud_world_profiles(
      id, project_id, owner_profile_id, kind, name, current_version
    ) values (v_id, p_project_id, v_owner, p_kind, trim(p_name), v_version);
  end if;
  insert into public.cloud_world_profile_versions(
    profile_id, project_id, owner_profile_id, version_number, description,
    visual_traits, color_palette, continuity_rules, prompt, negative_prompt
  ) values (
    v_id, p_project_id, v_owner, v_version, trim(coalesce(p_description, '')),
    v_traits, trim(coalesce(p_color_palette, '')), v_rules,
    trim(coalesce(p_prompt, '')), trim(coalesce(p_negative_prompt, ''))
  );
  return v_id;
end $$;

create or replace function public.delete_cloud_world_profile(
  p_project_id uuid, p_profile_id uuid
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.cloud_world_profiles set deleted_at = now(), updated_at = now()
    where id = p_profile_id and project_id = p_project_id
      and owner_profile_id = public.current_profile_id() and deleted_at is null;
  if not found then raise exception 'cloud_world_profile_not_found'; end if;
end $$;

revoke all on function public.save_cloud_style_bible(uuid,text,text,text,text,text,text) from public, anon;
revoke all on function public.save_cloud_world_profile(uuid,uuid,text,text,text,text[],text,text[],text,text) from public, anon;
revoke all on function public.delete_cloud_world_profile(uuid,uuid) from public, anon;
grant execute on function public.save_cloud_style_bible(uuid,text,text,text,text,text,text) to authenticated, service_role;
grant execute on function public.save_cloud_world_profile(uuid,uuid,text,text,text,text[],text,text[],text,text) to authenticated, service_role;
grant execute on function public.delete_cloud_world_profile(uuid,uuid) to authenticated, service_role;

commit;
