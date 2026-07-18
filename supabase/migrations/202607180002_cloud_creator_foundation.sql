begin;

create table public.cloud_projects (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_surface text not null default 'cloud' check (source_surface in ('cloud', 'desktop')),
  source_project_id uuid,
  content_class text not null default 'general' check (content_class = 'general'),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  age_rating text not null default '全年齢' check (age_rating in ('全年齢', '12歳以上', '15歳以上')),
  reading_direction text not null default 'rtl' check (reading_direction in ('rtl', 'ltr')),
  width integer not null default 1600 check (width between 100 and 20000),
  height integer not null default 2400 check (height between 100 and 20000),
  dpi integer not null default 300 check (dpi between 72 and 1200),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  revision bigint not null default 0 check (revision >= 0),
  storage_bytes bigint not null default 0 check (storage_bytes between 0 and 2147483648),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_profile_id, source_project_id)
);

create table public.cloud_project_collaborators (
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  invitee_profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (project_id, invitee_profile_id)
);

create table public.cloud_episodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  order_index integer not null check (order_index >= 0),
  revision bigint not null default 0 check (revision >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, order_index),
  unique (id, project_id)
);

create table public.cloud_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  episode_id uuid not null,
  page_number integer not null check (page_number >= 1),
  order_index integer not null check (order_index >= 0),
  width integer not null check (width between 100 and 20000),
  height integer not null check (height between 100 and 20000),
  background_color text not null default '#ffffff' check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  revision bigint not null default 0 check (revision >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, order_index),
  unique (id, project_id),
  foreign key (episode_id, project_id) references public.cloud_episodes(id, project_id) on delete cascade
);

create table public.cloud_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 700),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sha256)
);

create table public.cloud_canvas_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  page_id uuid not null,
  revision bigint not null check (revision >= 0),
  canvas jsonb not null check (jsonb_typeof(canvas) = 'object'),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (page_id, revision),
  foreign key (page_id, project_id) references public.cloud_pages(id, project_id) on delete cascade
);

create table public.cloud_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  revision bigint not null check (revision >= 0),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

create index cloud_projects_owner_active_idx on public.cloud_projects (owner_profile_id, updated_at desc) where deleted_at is null;
create index cloud_projects_public_idx on public.cloud_projects (updated_at desc) where visibility = 'public' and deleted_at is null;
create index cloud_collaborators_invitee_idx on public.cloud_project_collaborators (invitee_profile_id, status);
create index cloud_episodes_project_idx on public.cloud_episodes (project_id, order_index) where deleted_at is null;
create index cloud_pages_project_idx on public.cloud_pages (project_id, episode_id, order_index) where deleted_at is null;
create index cloud_assets_project_idx on public.cloud_assets (project_id, created_at) where deleted_at is null;
create index cloud_snapshots_page_idx on public.cloud_canvas_snapshots (page_id, revision desc);
create index cloud_versions_project_idx on public.cloud_project_versions (project_id, revision desc);

create or replace function public.protect_cloud_project_boundary()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_profile_id <> old.owner_profile_id
     or new.content_class <> old.content_class
     or new.source_surface <> old.source_surface
     or new.source_project_id is distinct from old.source_project_id then
    raise exception 'cloud_project_boundary_is_immutable';
  end if;
  return new;
end;
$$;
create trigger cloud_projects_boundary_guard
before update on public.cloud_projects
for each row execute function public.protect_cloud_project_boundary();

create or replace function public.cloud_project_can_read(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cloud_projects project
    where project.id = p_project_id
      and project.content_class = 'general'
      and (
        public.is_admin()
        or project.owner_profile_id = public.current_profile_id()
        or (
          project.deleted_at is null
          and (
            project.visibility in ('public', 'unlisted')
            or exists (
              select 1 from public.cloud_project_collaborators collaborator
              where collaborator.project_id = project.id
                and collaborator.invitee_profile_id = public.current_profile_id()
                and collaborator.status = 'accepted'
            )
          )
        )
      )
  );
$$;

create or replace function public.cloud_project_can_edit(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cloud_projects project
    where project.id = p_project_id
      and project.content_class = 'general'
      and project.deleted_at is null
      and (
        public.is_admin()
        or project.owner_profile_id = public.current_profile_id()
        or exists (
          select 1 from public.cloud_project_collaborators collaborator
          where collaborator.project_id = project.id
            and collaborator.invitee_profile_id = public.current_profile_id()
            and collaborator.status = 'accepted'
            and collaborator.role = 'editor'
        )
      )
  );
$$;

alter table public.cloud_projects enable row level security;
alter table public.cloud_project_collaborators enable row level security;
alter table public.cloud_episodes enable row level security;
alter table public.cloud_pages enable row level security;
alter table public.cloud_assets enable row level security;
alter table public.cloud_canvas_snapshots enable row level security;
alter table public.cloud_project_versions enable row level security;

grant select on public.cloud_projects, public.cloud_project_collaborators,
  public.cloud_episodes, public.cloud_pages, public.cloud_assets,
  public.cloud_canvas_snapshots, public.cloud_project_versions to anon, authenticated;
grant insert, update, delete on public.cloud_projects, public.cloud_project_collaborators,
  public.cloud_episodes, public.cloud_pages, public.cloud_assets to authenticated;
grant insert on public.cloud_canvas_snapshots, public.cloud_project_versions to authenticated;

create policy "cloud_projects_read" on public.cloud_projects for select
using (public.cloud_project_can_read(id));
create policy "cloud_projects_insert" on public.cloud_projects for insert
with check (owner_profile_id = public.current_profile_id() and content_class = 'general');
create policy "cloud_projects_update" on public.cloud_projects for update
using (public.cloud_project_can_edit(id) or owner_profile_id = public.current_profile_id() or public.is_admin())
with check (content_class = 'general' and (public.cloud_project_can_edit(id) or owner_profile_id = public.current_profile_id() or public.is_admin()));
create policy "cloud_projects_delete" on public.cloud_projects for delete
using (owner_profile_id = public.current_profile_id() or public.is_admin());

create policy "cloud_collaborators_read" on public.cloud_project_collaborators for select
using (public.cloud_project_can_read(project_id) or invitee_profile_id = public.current_profile_id());
create policy "cloud_collaborators_owner_write" on public.cloud_project_collaborators for all
using (exists (select 1 from public.cloud_projects where id = project_id and (owner_profile_id = public.current_profile_id() or public.is_admin())))
with check (exists (select 1 from public.cloud_projects where id = project_id and (owner_profile_id = public.current_profile_id() or public.is_admin())));

create policy "cloud_episodes_read" on public.cloud_episodes for select using (public.cloud_project_can_read(project_id));
create policy "cloud_episodes_write" on public.cloud_episodes for all using (public.cloud_project_can_edit(project_id)) with check (public.cloud_project_can_edit(project_id));
create policy "cloud_pages_read" on public.cloud_pages for select using (public.cloud_project_can_read(project_id));
create policy "cloud_pages_write" on public.cloud_pages for all using (public.cloud_project_can_edit(project_id)) with check (public.cloud_project_can_edit(project_id));
create policy "cloud_assets_read" on public.cloud_assets for select using (public.cloud_project_can_read(project_id));
create policy "cloud_assets_write" on public.cloud_assets for all using (public.cloud_project_can_edit(project_id)) with check (owner_profile_id = public.current_profile_id() and public.cloud_project_can_edit(project_id));
create policy "cloud_snapshots_read" on public.cloud_canvas_snapshots for select using (public.cloud_project_can_read(project_id));
create policy "cloud_snapshots_insert" on public.cloud_canvas_snapshots for insert with check (created_by_profile_id = public.current_profile_id() and public.cloud_project_can_edit(project_id));
create policy "cloud_versions_read" on public.cloud_project_versions for select using (public.cloud_project_can_read(project_id));
create policy "cloud_versions_insert" on public.cloud_project_versions for insert with check (created_by_profile_id = public.current_profile_id() and public.cloud_project_can_edit(project_id));

create or replace function public.refresh_cloud_project_storage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid := coalesce(new.project_id, old.project_id);
  v_total bigint;
begin
  select coalesce(sum(byte_size), 0) into v_total
  from public.cloud_assets
  where project_id = v_project_id and deleted_at is null;
  if v_total > 2147483648 then
    raise exception 'cloud_project_storage_limit';
  end if;
  update public.cloud_projects set storage_bytes = v_total, updated_at = now() where id = v_project_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger cloud_assets_storage_total
after insert or update or delete on public.cloud_assets
for each row execute function public.refresh_cloud_project_storage();

create or replace function public.save_cloud_page_snapshot(
  p_page_id uuid,
  p_expected_revision bigint,
  p_canvas jsonb
)
returns table(page_id uuid, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_page public.cloud_pages%rowtype;
  v_profile_id uuid := public.current_profile_id();
  v_project_revision bigint;
  v_now timestamptz := clock_timestamp();
begin
  if v_profile_id is null or jsonb_typeof(p_canvas) <> 'object' or pg_column_size(p_canvas) > 2097152 then
    raise exception 'invalid_snapshot_input';
  end if;
  select * into v_page from public.cloud_pages where id = p_page_id for update;
  if not found or not public.cloud_project_can_edit(v_page.project_id) then
    raise exception 'page_not_found';
  end if;
  if v_page.revision <> p_expected_revision then
    raise exception 'revision_conflict:%', v_page.revision;
  end if;
  update public.cloud_pages
  set revision = cloud_pages.revision + 1, updated_at = v_now
  where id = p_page_id
  returning cloud_pages.revision into revision;
  insert into public.cloud_canvas_snapshots(project_id, page_id, revision, canvas, created_by_profile_id, created_at)
  values (v_page.project_id, p_page_id, revision, p_canvas, v_profile_id, v_now);
  update public.cloud_projects
  set revision = cloud_projects.revision + 1, updated_at = v_now
  where id = v_page.project_id
  returning cloud_projects.revision into v_project_revision;
  insert into public.cloud_project_versions(project_id, revision, manifest, created_by_profile_id, created_at)
  values (
    v_page.project_id,
    v_project_revision,
    jsonb_build_object('event', 'page_snapshot', 'pageId', p_page_id, 'pageRevision', revision),
    v_profile_id,
    v_now
  );
  page_id := p_page_id;
  updated_at := v_now;
  return next;
end;
$$;

create or replace function public.soft_delete_cloud_project(p_project_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.cloud_projects set deleted_at = now(), updated_at = now()
  where id = p_project_id
    and deleted_at is null
    and (owner_profile_id = public.current_profile_id() or public.is_admin());
  if not found then raise exception 'cloud_project_not_found'; end if;
  return p_project_id;
end;
$$;

create or replace function public.restore_cloud_project(p_project_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.cloud_projects set deleted_at = null, updated_at = now()
  where id = p_project_id
    and deleted_at >= now() - interval '30 days'
    and (owner_profile_id = public.current_profile_id() or public.is_admin());
  if not found then raise exception 'cloud_project_restore_unavailable'; end if;
  return p_project_id;
end;
$$;

create or replace function public.import_cloud_project(p_manifest jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_project_id uuid := gen_random_uuid();
  v_episode jsonb;
  v_page jsonb;
  v_snapshot jsonb;
begin
  if v_profile_id is null
     or pg_column_size(p_manifest) > 10485760
     or p_manifest->>'format' <> 'mangai.cloud-project'
     or p_manifest->>'version' <> '1'
     or p_manifest->>'policyVersion' <> '1'
     or p_manifest->>'createdBySurface' <> 'desktop'
     or p_manifest->'project'->>'contentClass' <> 'general'
     or p_manifest->'project'->>'ageRating' not in ('全年齢', '12歳以上', '15歳以上') then
    raise exception 'general_cloud_import_required';
  end if;
  insert into public.cloud_projects(
    id, owner_profile_id, source_surface, source_project_id, content_class,
    title, description, age_rating, reading_direction, width, height, dpi
  ) values (
    v_project_id, v_profile_id, 'desktop', (p_manifest->'project'->>'sourceProjectId')::uuid, 'general',
    p_manifest->'project'->>'title', coalesce(p_manifest->'project'->>'description', ''),
    p_manifest->'project'->>'ageRating', p_manifest->'project'->>'readingDirection',
    (p_manifest->'project'->>'width')::integer, (p_manifest->'project'->>'height')::integer,
    (p_manifest->'project'->>'dpi')::integer
  );
  for v_episode in select value from jsonb_array_elements(coalesce(p_manifest->'episodes', '[]'::jsonb)) loop
    insert into public.cloud_episodes(id, project_id, title, order_index)
    values ((v_episode->>'id')::uuid, v_project_id, v_episode->>'title', (v_episode->>'orderIndex')::integer);
  end loop;
  for v_page in select value from jsonb_array_elements(coalesce(p_manifest->'pages', '[]'::jsonb)) loop
    insert into public.cloud_pages(id, project_id, episode_id, page_number, order_index, width, height, background_color)
    values (
      (v_page->>'id')::uuid, v_project_id, (v_page->>'episodeId')::uuid,
      (v_page->>'pageNumber')::integer, (v_page->>'orderIndex')::integer,
      (v_page->>'width')::integer, (v_page->>'height')::integer, v_page->>'backgroundColor'
    );
  end loop;
  for v_snapshot in select value from jsonb_array_elements(coalesce(p_manifest->'snapshots', '[]'::jsonb)) loop
    insert into public.cloud_canvas_snapshots(project_id, page_id, revision, canvas, created_by_profile_id)
    values (v_project_id, (v_snapshot->>'pageId')::uuid, 0, v_snapshot->'canvas', v_profile_id);
  end loop;
  insert into public.cloud_project_versions(project_id, revision, manifest, created_by_profile_id)
  values (v_project_id, 0, p_manifest, v_profile_id);
  return v_project_id;
end;
$$;

revoke execute on function public.save_cloud_page_snapshot(uuid,bigint,jsonb) from public, anon;
revoke execute on function public.soft_delete_cloud_project(uuid) from public, anon;
revoke execute on function public.restore_cloud_project(uuid) from public, anon;
revoke execute on function public.import_cloud_project(jsonb) from public, anon;
grant execute on function public.save_cloud_page_snapshot(uuid,bigint,jsonb) to authenticated, service_role;
grant execute on function public.soft_delete_cloud_project(uuid) to authenticated, service_role;
grant execute on function public.restore_cloud_project(uuid) to authenticated, service_role;
grant execute on function public.import_cloud_project(jsonb) to authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('cloud-assets', 'cloud-assets', false, 20971520, array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "cloud_assets_storage_read" on storage.objects for select using (
  bucket_id = 'cloud-assets'
  and case
    when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then public.cloud_project_can_read(((storage.foldername(name))[2])::uuid)
    else false
  end
);
create policy "cloud_assets_storage_insert" on storage.objects for insert with check (
  bucket_id = 'cloud-assets'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = public.current_profile_id()::text
  and case
    when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid)
    else false
  end
);
create policy "cloud_assets_storage_update" on storage.objects for update
using (
  bucket_id = 'cloud-assets'
  and (storage.foldername(name))[1] = public.current_profile_id()::text
  and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid) else false end
)
with check (
  bucket_id = 'cloud-assets'
  and (storage.foldername(name))[1] = public.current_profile_id()::text
  and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid) else false end
);
create policy "cloud_assets_storage_delete" on storage.objects for delete using (
  bucket_id = 'cloud-assets'
  and (storage.foldername(name))[1] = public.current_profile_id()::text
  and case when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then public.cloud_project_can_edit(((storage.foldername(name))[2])::uuid) else false end
);

commit;
