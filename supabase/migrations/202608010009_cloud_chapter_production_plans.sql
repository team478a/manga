begin;

create table public.cloud_chapter_production_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  chapter_id uuid not null references public.cloud_chapters(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
  assignee_name text not null default '' check(char_length(assignee_name)<=100),
  due_date date,
  notes text not null default '' check(char_length(notes)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,chapter_id)
);

create index cloud_chapter_production_plans_due_idx on public.cloud_chapter_production_plans(project_id,due_date,priority);
alter table public.cloud_chapter_production_plans enable row level security;
grant select on public.cloud_chapter_production_plans to authenticated;
grant select,insert,update,delete on public.cloud_chapter_production_plans to service_role;
create policy "cloud_chapter_production_plans_owner_read" on public.cloud_chapter_production_plans for select
  using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));

create or replace function public.save_cloud_chapter_production_plan(
  p_project_id uuid,p_chapter_id uuid,p_priority text,p_assignee_name text,p_due_date date,p_notes text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_id uuid;
begin
  if v_owner is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_chapter_plan_project_not_found';end if;
  if not exists(select 1 from public.cloud_chapters where id=p_chapter_id and project_id=p_project_id) then raise exception 'cloud_chapter_plan_chapter_not_found';end if;
  if p_priority not in('low','normal','high','urgent') or char_length(trim(coalesce(p_assignee_name,'')))>100 or char_length(trim(coalesce(p_notes,'')))>1000 then raise exception 'cloud_chapter_plan_invalid';end if;
  insert into public.cloud_chapter_production_plans(project_id,chapter_id,owner_profile_id,priority,assignee_name,due_date,notes)
  values(p_project_id,p_chapter_id,v_owner,p_priority,trim(coalesce(p_assignee_name,'')),p_due_date,trim(coalesce(p_notes,'')))
  on conflict(project_id,chapter_id) do update set priority=excluded.priority,assignee_name=excluded.assignee_name,
    due_date=excluded.due_date,notes=excluded.notes,updated_at=now()
  where cloud_chapter_production_plans.owner_profile_id=v_owner
  returning id into v_id;
  if v_id is null then raise exception 'cloud_chapter_plan_not_found';end if;
  return v_id;
end $$;

revoke all on function public.save_cloud_chapter_production_plan(uuid,uuid,text,text,date,text) from public,anon;
grant execute on function public.save_cloud_chapter_production_plan(uuid,uuid,text,text,date,text) to authenticated,service_role;

commit;
