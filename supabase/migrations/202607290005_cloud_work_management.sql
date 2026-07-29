begin;

create table public.cloud_work_management_states (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null unique references public.cloud_projects(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','review_ready','approved')),
  expected_project_revision bigint,
  release_notes text not null default ''
    check (char_length(release_notes) <= 5000),
  review_ready_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'draft' and expected_project_revision is null and approved_at is null)
    or
    (status = 'review_ready' and expected_project_revision is not null and review_ready_at is not null and approved_at is null)
    or
    (status = 'approved' and expected_project_revision is not null and review_ready_at is not null and approved_at is not null)
  )
);

create table public.cloud_work_page_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  page_id uuid not null unique references public.cloud_pages(id) on delete cascade,
  page_revision bigint not null check (page_revision >= 0),
  note text not null default '' check (char_length(note) <= 500),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, page_id)
);

create index cloud_work_management_owner_idx
on public.cloud_work_management_states(owner_profile_id, updated_at desc);

create index cloud_work_page_reviews_project_idx
on public.cloud_work_page_reviews(owner_profile_id, project_id, reviewed_at desc);

alter table public.cloud_work_management_states enable row level security;
alter table public.cloud_work_page_reviews enable row level security;

grant select on public.cloud_work_management_states, public.cloud_work_page_reviews
to authenticated;
grant select, insert, update, delete
on public.cloud_work_management_states, public.cloud_work_page_reviews
to service_role;

create policy "cloud_work_management_owner_read"
on public.cloud_work_management_states for select
using (owner_profile_id = public.current_profile_id());

create policy "cloud_work_page_reviews_owner_read"
on public.cloud_work_page_reviews for select
using (owner_profile_id = public.current_profile_id());

create or replace function public.reset_cloud_work_management_on_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.revision is distinct from old.revision then
    update public.cloud_work_management_states
    set
      status = 'draft',
      expected_project_revision = null,
      review_ready_at = null,
      approved_at = null,
      updated_at = now()
    where project_id = new.id;
  end if;
  return new;
end
$$;

create trigger cloud_projects_reset_work_management
after update of revision on public.cloud_projects
for each row execute function public.reset_cloud_work_management_on_revision();

create or replace function public.set_cloud_work_page_review(
  p_project_id uuid,
  p_page_id uuid,
  p_reviewed boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_project public.cloud_projects%rowtype;
  v_page public.cloud_pages%rowtype;
begin
  if v_profile_id is null
     or p_reviewed is null
     or char_length(coalesce(p_note, '')) > 500 then
    raise exception 'cloud_work_input_invalid';
  end if;

  select * into v_project
  from public.cloud_projects
  where id = p_project_id
    and owner_profile_id = v_profile_id
    and content_class = 'general'
    and deleted_at is null
  for update;
  if not found then raise exception 'cloud_work_project_not_found'; end if;

  select * into v_page
  from public.cloud_pages
  where id = p_page_id
    and project_id = p_project_id
    and deleted_at is null;
  if not found then raise exception 'cloud_work_page_not_found'; end if;

  if p_reviewed then
    insert into public.cloud_work_page_reviews(
      owner_profile_id, project_id, page_id, page_revision,
      note, reviewed_at, updated_at
    )
    values(
      v_profile_id, p_project_id, p_page_id, v_page.revision,
      trim(coalesce(p_note, '')), now(), now()
    )
    on conflict(page_id) do update
    set
      owner_profile_id = excluded.owner_profile_id,
      project_id = excluded.project_id,
      page_revision = excluded.page_revision,
      note = excluded.note,
      reviewed_at = excluded.reviewed_at,
      updated_at = excluded.updated_at;
  else
    delete from public.cloud_work_page_reviews
    where page_id = p_page_id
      and project_id = p_project_id
      and owner_profile_id = v_profile_id;
  end if;

  insert into public.cloud_work_management_states(
    owner_profile_id, project_id, status
  )
  values(v_profile_id, p_project_id, 'draft')
  on conflict(project_id) do update
  set
    status = 'draft',
    expected_project_revision = null,
    review_ready_at = null,
    approved_at = null,
    updated_at = now();

  return p_page_id;
end
$$;

create or replace function public.set_cloud_work_management_status(
  p_project_id uuid,
  p_status text,
  p_release_notes text,
  p_expected_project_revision bigint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_project public.cloud_projects%rowtype;
  v_state public.cloud_work_management_states%rowtype;
  v_page_count integer;
begin
  if v_profile_id is null
     or p_status not in ('draft','review_ready','approved')
     or p_expected_project_revision is null
     or char_length(coalesce(p_release_notes, '')) > 5000 then
    raise exception 'cloud_work_input_invalid';
  end if;

  select * into v_project
  from public.cloud_projects
  where id = p_project_id
    and owner_profile_id = v_profile_id
    and content_class = 'general'
    and deleted_at is null
  for update;
  if not found then raise exception 'cloud_work_project_not_found'; end if;
  if v_project.revision <> p_expected_project_revision then
    raise exception 'cloud_work_revision_conflict';
  end if;

  insert into public.cloud_work_management_states(
    owner_profile_id, project_id, status
  )
  values(v_profile_id, p_project_id, 'draft')
  on conflict(project_id) do nothing;

  select * into v_state
  from public.cloud_work_management_states
  where project_id = p_project_id
    and owner_profile_id = v_profile_id
  for update;

  if p_status = 'draft' then
    update public.cloud_work_management_states
    set
      status = 'draft',
      expected_project_revision = null,
      release_notes = trim(coalesce(p_release_notes, '')),
      review_ready_at = null,
      approved_at = null,
      updated_at = now()
    where project_id = p_project_id;
    return 'draft';
  end if;

  select count(*) into v_page_count
  from public.cloud_pages
  where project_id = p_project_id and deleted_at is null;

  if nullif(trim(v_project.title), '') is null
     or nullif(trim(v_project.description), '') is null
     or v_page_count not between 1 and 200
     or v_project.cover_page_id is null
     or not exists(
       select 1 from public.cloud_pages
       where id = v_project.cover_page_id
         and project_id = p_project_id
         and deleted_at is null
     )
     or exists(
       select 1
       from public.cloud_pages page
       where page.project_id = p_project_id
         and page.deleted_at is null
         and not exists(
           select 1 from public.cloud_canvas_snapshots snapshot
           where snapshot.page_id = page.id
             and snapshot.project_id = p_project_id
         )
     )
     or exists(
       select 1
       from public.cloud_pages page
       where page.project_id = p_project_id
         and page.deleted_at is null
         and not exists(
           select 1 from public.cloud_work_page_reviews review
           where review.page_id = page.id
             and review.project_id = p_project_id
             and review.owner_profile_id = v_profile_id
             and review.page_revision = page.revision
         )
     )
     or exists(
       select 1 from public.cloud_generation_jobs
       where project_id = p_project_id and status in ('queued','running')
     ) then
    raise exception 'cloud_work_not_ready';
  end if;

  if p_status = 'approved'
     and (
       v_state.status <> 'review_ready'
       or v_state.expected_project_revision <> v_project.revision
     ) then
    raise exception 'cloud_work_status_transition_invalid';
  end if;

  update public.cloud_work_management_states
  set
    status = p_status,
    expected_project_revision = v_project.revision,
    release_notes = trim(coalesce(p_release_notes, '')),
    review_ready_at = case
      when p_status = 'review_ready' then now()
      else review_ready_at
    end,
    approved_at = case when p_status = 'approved' then now() else null end,
    updated_at = now()
  where project_id = p_project_id;
  return p_status;
end
$$;

revoke all on function public.reset_cloud_work_management_on_revision()
from public, anon, authenticated;
revoke all on function public.set_cloud_work_page_review(uuid,uuid,boolean,text)
from public, anon;
revoke all on function public.set_cloud_work_management_status(uuid,text,text,bigint)
from public, anon;
grant execute on function public.set_cloud_work_page_review(uuid,uuid,boolean,text)
to authenticated, service_role;
grant execute on function public.set_cloud_work_management_status(uuid,text,text,bigint)
to authenticated, service_role;

commit;
