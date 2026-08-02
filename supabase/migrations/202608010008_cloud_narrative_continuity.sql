begin;

create table public.cloud_continuity_facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  fact_kind text not null check(fact_kind in('appearance','location','relationship','timeline','prop','speech')),
  subject text not null check(char_length(trim(subject)) between 1 and 100),
  attribute text not null check(char_length(trim(attribute)) between 1 and 100),
  fact_value text not null check(char_length(trim(fact_value)) between 1 and 500),
  start_page integer not null check(start_page between 1 and 1000),
  end_page integer not null check(end_page between start_page and 1000),
  source_page integer check(source_page is null or source_page between start_page and end_page),
  notes text not null default '' check(char_length(notes)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cloud_plot_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 150),
  setup_page integer not null check(setup_page between 1 and 1000),
  target_payoff_page integer check(target_payoff_page is null or target_payoff_page between setup_page and 1000),
  payoff_page integer check(payoff_page is null or payoff_page between setup_page and 1000),
  status text not null default 'planned' check(status in('planned','planted','resolved','dropped')),
  notes text not null default '' check(char_length(notes)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cloud_continuity_facts_project_range_idx on public.cloud_continuity_facts(project_id,start_page,end_page);
create index cloud_plot_threads_project_status_idx on public.cloud_plot_threads(project_id,status,target_payoff_page);
alter table public.cloud_continuity_facts enable row level security;
alter table public.cloud_plot_threads enable row level security;
grant select on public.cloud_continuity_facts,public.cloud_plot_threads to authenticated;
grant select,insert,update,delete on public.cloud_continuity_facts,public.cloud_plot_threads to service_role;

create policy "cloud_continuity_facts_owner_read" on public.cloud_continuity_facts for select
  using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));
create policy "cloud_plot_threads_owner_read" on public.cloud_plot_threads for select
  using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));

create or replace function public.save_cloud_continuity_fact(
  p_project_id uuid,p_fact_id uuid,p_fact_kind text,p_subject text,p_attribute text,p_fact_value text,
  p_start_page integer,p_end_page integer,p_source_page integer,p_notes text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_id uuid:=coalesce(p_fact_id,gen_random_uuid());
begin
  if v_owner is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_continuity_project_not_found';end if;
  if p_fact_kind not in('appearance','location','relationship','timeline','prop','speech')
    or char_length(trim(coalesce(p_subject,''))) not between 1 and 100
    or char_length(trim(coalesce(p_attribute,''))) not between 1 and 100
    or char_length(trim(coalesce(p_fact_value,''))) not between 1 and 500
    or p_start_page not between 1 and 1000 or p_end_page not between p_start_page and 1000
    or (p_source_page is not null and p_source_page not between p_start_page and p_end_page)
    or char_length(coalesce(p_notes,''))>1000 then raise exception 'cloud_continuity_fact_invalid';end if;
  insert into public.cloud_continuity_facts(id,project_id,owner_profile_id,fact_kind,subject,attribute,fact_value,start_page,end_page,source_page,notes)
  values(v_id,p_project_id,v_owner,p_fact_kind,trim(p_subject),trim(p_attribute),trim(p_fact_value),p_start_page,p_end_page,p_source_page,trim(coalesce(p_notes,'')))
  on conflict(id) do update set fact_kind=excluded.fact_kind,subject=excluded.subject,attribute=excluded.attribute,
    fact_value=excluded.fact_value,start_page=excluded.start_page,end_page=excluded.end_page,source_page=excluded.source_page,
    notes=excluded.notes,updated_at=now()
  where cloud_continuity_facts.project_id=p_project_id and cloud_continuity_facts.owner_profile_id=v_owner;
  if not found then raise exception 'cloud_continuity_fact_not_found';end if;
  return v_id;
end $$;

create or replace function public.delete_cloud_continuity_fact(p_project_id uuid,p_fact_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  delete from public.cloud_continuity_facts where id=p_fact_id and project_id=p_project_id and owner_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id);
  if not found then raise exception 'cloud_continuity_fact_not_found';end if;
end $$;

create or replace function public.save_cloud_plot_thread(
  p_project_id uuid,p_thread_id uuid,p_title text,p_setup_page integer,p_target_payoff_page integer,
  p_payoff_page integer,p_status text,p_notes text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_id uuid:=coalesce(p_thread_id,gen_random_uuid());
begin
  if v_owner is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_continuity_project_not_found';end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 150 or p_setup_page not between 1 and 1000
    or (p_target_payoff_page is not null and p_target_payoff_page not between p_setup_page and 1000)
    or (p_payoff_page is not null and p_payoff_page not between p_setup_page and 1000)
    or p_status not in('planned','planted','resolved','dropped') or char_length(coalesce(p_notes,''))>1000
    then raise exception 'cloud_plot_thread_invalid';end if;
  insert into public.cloud_plot_threads(id,project_id,owner_profile_id,title,setup_page,target_payoff_page,payoff_page,status,notes)
  values(v_id,p_project_id,v_owner,trim(p_title),p_setup_page,p_target_payoff_page,p_payoff_page,p_status,trim(coalesce(p_notes,'')))
  on conflict(id) do update set title=excluded.title,setup_page=excluded.setup_page,target_payoff_page=excluded.target_payoff_page,
    payoff_page=excluded.payoff_page,status=excluded.status,notes=excluded.notes,updated_at=now()
  where cloud_plot_threads.project_id=p_project_id and cloud_plot_threads.owner_profile_id=v_owner;
  if not found then raise exception 'cloud_plot_thread_not_found';end if;
  return v_id;
end $$;

create or replace function public.delete_cloud_plot_thread(p_project_id uuid,p_thread_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  delete from public.cloud_plot_threads where id=p_thread_id and project_id=p_project_id and owner_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id);
  if not found then raise exception 'cloud_plot_thread_not_found';end if;
end $$;

revoke all on function public.save_cloud_continuity_fact(uuid,uuid,text,text,text,text,integer,integer,integer,text) from public,anon;
revoke all on function public.delete_cloud_continuity_fact(uuid,uuid) from public,anon;
revoke all on function public.save_cloud_plot_thread(uuid,uuid,text,integer,integer,integer,text,text) from public,anon;
revoke all on function public.delete_cloud_plot_thread(uuid,uuid) from public,anon;
grant execute on function public.save_cloud_continuity_fact(uuid,uuid,text,text,text,text,integer,integer,integer,text) to authenticated,service_role;
grant execute on function public.delete_cloud_continuity_fact(uuid,uuid) to authenticated,service_role;
grant execute on function public.save_cloud_plot_thread(uuid,uuid,text,integer,integer,integer,text,text) to authenticated,service_role;
grant execute on function public.delete_cloud_plot_thread(uuid,uuid) to authenticated,service_role;

commit;
