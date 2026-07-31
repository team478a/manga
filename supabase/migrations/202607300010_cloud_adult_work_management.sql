begin;

create table public.cloud_adult_work_management_settings(
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.cloud_adult_work_management_settings(singleton,enabled)
values(true,false);
alter table public.cloud_adult_work_management_settings enable row level security;
grant select on public.cloud_adult_work_management_settings to authenticated;
grant select,update on public.cloud_adult_work_management_settings to service_role;
create policy "cloud_adult_work_management_settings_read"
on public.cloud_adult_work_management_settings for select using(true);

create or replace function public.can_use_cloud_adult_work_management()
returns boolean language sql stable security definer set search_path=public as $$
select public.can_use_cloud_adult_storyboard()
and exists(
  select 1 from public.cloud_adult_work_management_settings settings
  where settings.singleton and settings.enabled
);
$$;
grant execute on function public.can_use_cloud_adult_work_management()
to authenticated;

create or replace function public.set_cloud_adult_work_management_enabled(
  p_actor_profile_id uuid,p_enabled boolean
) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then raise exception 'cloud_adult_work_management_admin_required';end if;
  update public.cloud_adult_work_management_settings
  set enabled=p_enabled,updated_by_profile_id=p_actor_profile_id,updated_at=now()
  where singleton;
end;
$$;
grant execute on function public.set_cloud_adult_work_management_enabled(
  uuid,boolean
) to service_role;

create table public.cloud_adult_work_records(
  project_id uuid primary key references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check(status in('draft','editing','review','completed','archived')),
  notes text not null default '' check(char_length(notes)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cloud_adult_work_records_owner_updated_idx
on public.cloud_adult_work_records(owner_profile_id,updated_at desc);
alter table public.cloud_adult_work_records enable row level security;
grant select,insert,update on public.cloud_adult_work_records to authenticated;
grant select,insert,update,delete on public.cloud_adult_work_records to service_role;
create policy "cloud_adult_work_records_owner_read"
on public.cloud_adult_work_records for select using(
  owner_profile_id=public.current_profile_id()
  and public.can_use_cloud_adult_work_management()
  and exists(
    select 1 from public.cloud_projects project
    where project.id=project_id
      and project.owner_profile_id=public.current_profile_id()
      and project.content_class='adult'
      and project.visibility='private'
      and project.deleted_at is null
  )
);
create policy "cloud_adult_work_records_owner_insert"
on public.cloud_adult_work_records for insert with check(
  owner_profile_id=public.current_profile_id()
  and public.can_use_cloud_adult_work_management()
  and exists(
    select 1 from public.cloud_projects project
    where project.id=project_id
      and project.owner_profile_id=public.current_profile_id()
      and project.content_class='adult'
      and project.visibility='private'
      and project.deleted_at is null
  )
);
create policy "cloud_adult_work_records_owner_update"
on public.cloud_adult_work_records for update using(
  owner_profile_id=public.current_profile_id()
  and public.can_use_cloud_adult_work_management()
) with check(
  owner_profile_id=public.current_profile_id()
  and public.can_use_cloud_adult_work_management()
);

create or replace function public.register_cloud_adult_work()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.content_class='adult' then
    insert into public.cloud_adult_work_records(project_id,owner_profile_id)
    values(new.id,new.owner_profile_id)
    on conflict(project_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger cloud_projects_register_adult_work
after insert on public.cloud_projects
for each row execute function public.register_cloud_adult_work();

insert into public.cloud_adult_work_records(project_id,owner_profile_id)
select project.id,project.owner_profile_id
from public.cloud_projects project
where project.content_class='adult'
on conflict(project_id) do nothing;

create or replace function public.update_cloud_adult_work(
  p_project_id uuid,p_title text,p_description text,p_status text,p_notes text
) returns void language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id();
begin
  if v_profile_id is null or not public.can_use_cloud_adult_work_management()
  then raise exception 'cloud_adult_work_not_allowed';end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 200
    or char_length(coalesce(p_description,''))>5000
    or p_status not in('draft','editing','review','completed','archived')
    or char_length(coalesce(p_notes,''))>2000
  then raise exception 'cloud_adult_work_invalid';end if;
  if not exists(
    select 1 from public.cloud_projects project
    where project.id=p_project_id
      and project.owner_profile_id=v_profile_id
      and project.content_class='adult'
      and project.visibility='private'
      and project.deleted_at is null
  ) then raise exception 'cloud_adult_work_not_found';end if;
  update public.cloud_projects
  set title=trim(p_title),description=coalesce(p_description,''),
    visibility='private',age_rating='18歳以上',
    revision=revision+1,updated_at=now()
  where id=p_project_id and owner_profile_id=v_profile_id;
  insert into public.cloud_adult_work_records(
    project_id,owner_profile_id,status,notes
  ) values(
    p_project_id,v_profile_id,p_status,coalesce(p_notes,'')
  ) on conflict(project_id) do update set
    status=excluded.status,notes=excluded.notes,updated_at=now()
  where cloud_adult_work_records.owner_profile_id=v_profile_id;
end;
$$;
grant execute on function public.update_cloud_adult_work(
  uuid,text,text,text,text
) to authenticated;

commit;
