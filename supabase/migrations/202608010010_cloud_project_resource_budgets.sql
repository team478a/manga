begin;

create table if not exists public.cloud_project_resource_budgets (
  project_id uuid primary key references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  monthly_credit_limit integer check(monthly_credit_limit is null or monthly_credit_limit between 1 and 1000000),
  monthly_cost_limit_micros bigint check(monthly_cost_limit_micros is null or monthly_cost_limit_micros between 10000 and 1000000000000),
  storage_limit_bytes bigint check(storage_limit_bytes is null or storage_limit_bytes between 1048576 and 1099511627776),
  warning_percent integer not null default 80 check(warning_percent between 50 and 100),
  generation_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cloud_project_resource_budgets enable row level security;
grant select on public.cloud_project_resource_budgets to authenticated;
grant select,insert,update,delete on public.cloud_project_resource_budgets to service_role;
drop policy if exists "cloud_project_resource_budgets_read" on public.cloud_project_resource_budgets;
create policy "cloud_project_resource_budgets_read" on public.cloud_project_resource_budgets for select
  using(public.cloud_project_can_read(project_id));

insert into public.cloud_project_resource_budgets(project_id,owner_profile_id)
select id,owner_profile_id from public.cloud_projects on conflict(project_id) do nothing;

create or replace function public.provision_cloud_project_resource_budget()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.cloud_project_resource_budgets(project_id,owner_profile_id)
  values(new.id,new.owner_profile_id) on conflict(project_id) do nothing;
  return new;
end $$;
drop trigger if exists cloud_projects_provision_resource_budget on public.cloud_projects;
create trigger cloud_projects_provision_resource_budget after insert on public.cloud_projects
for each row execute function public.provision_cloud_project_resource_budget();

create or replace function public.save_cloud_project_resource_budget(
  p_project_id uuid,p_monthly_credit_limit integer,p_monthly_cost_limit_micros bigint,
  p_storage_limit_bytes bigint,p_warning_percent integer,p_generation_enabled boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_project_owner uuid;
begin
  select owner_profile_id into v_project_owner from public.cloud_projects where id=p_project_id and deleted_at is null;
  if v_owner is null or v_project_owner is null or (v_project_owner<>v_owner and not public.is_admin()) then raise exception 'cloud_project_budget_not_editable';end if;
  if (p_monthly_credit_limit is not null and p_monthly_credit_limit not between 1 and 1000000)
    or (p_monthly_cost_limit_micros is not null and p_monthly_cost_limit_micros not between 10000 and 1000000000000)
    or (p_storage_limit_bytes is not null and p_storage_limit_bytes not between 1048576 and 1099511627776)
    or p_warning_percent not between 50 and 100 then raise exception 'cloud_project_budget_invalid';end if;
  insert into public.cloud_project_resource_budgets(project_id,owner_profile_id,monthly_credit_limit,monthly_cost_limit_micros,storage_limit_bytes,warning_percent,generation_enabled)
  values(p_project_id,v_project_owner,p_monthly_credit_limit,p_monthly_cost_limit_micros,p_storage_limit_bytes,p_warning_percent,p_generation_enabled)
  on conflict(project_id) do update set monthly_credit_limit=excluded.monthly_credit_limit,monthly_cost_limit_micros=excluded.monthly_cost_limit_micros,
    storage_limit_bytes=excluded.storage_limit_bytes,warning_percent=excluded.warning_percent,generation_enabled=excluded.generation_enabled,updated_at=now();
  return p_project_id;
end $$;

create or replace function public.get_cloud_project_resource_usage(p_project_id uuid)
returns table(monthly_credit_limit integer,monthly_cost_limit_micros bigint,storage_limit_bytes bigint,warning_percent integer,
  generation_enabled boolean,credits_reserved bigint,credits_used bigint,cost_reserved_micros bigint,cost_actual_micros bigint,
  storage_bytes bigint,job_count bigint,active_job_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.cloud_project_can_read(p_project_id) then raise exception 'cloud_project_budget_not_found';end if;
  return query
  select b.monthly_credit_limit,b.monthly_cost_limit_micros,b.storage_limit_bytes,b.warning_percent,b.generation_enabled,
    coalesce(sum(case when j.status in('queued','running') and j.billing_settled_at is null then j.reserved_credits else 0 end),0)::bigint,
    coalesce(sum(case when j.status='completed' then j.reserved_credits else 0 end),0)::bigint,
    coalesce(sum(case when j.status in('queued','running') and j.billing_settled_at is null then j.reserved_cost_micros else 0 end),0)::bigint,
    coalesce(sum(case when j.status in('completed','failed') then j.actual_cost_micros else 0 end),0)::bigint,
    coalesce((select sum(a.byte_size) from public.cloud_assets a where a.project_id=p_project_id),0)::bigint,
    count(j.id)::bigint,count(j.id) filter(where j.status in('queued','running'))::bigint
  from public.cloud_project_resource_budgets b
  left join public.cloud_generation_jobs j on j.project_id=b.project_id and j.created_at>=date_trunc('month',now())
  where b.project_id=p_project_id group by b.project_id;
end $$;

create or replace function public.enforce_cloud_project_generation_budget()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_budget public.cloud_project_resource_budgets%rowtype;v_credits bigint;v_cost bigint;v_storage bigint;
begin
  select * into v_budget from public.cloud_project_resource_budgets where project_id=new.project_id for update;
  if not found then return new;end if;
  if not v_budget.generation_enabled then raise exception 'cloud_project_generation_disabled';end if;
  select coalesce(sum(case when status='completed' then reserved_credits when status in('queued','running') and billing_settled_at is null then reserved_credits else 0 end),0),
    coalesce(sum(case when status in('completed','failed') then actual_cost_micros when status in('queued','running') and billing_settled_at is null then reserved_cost_micros else 0 end),0)
    into v_credits,v_cost from public.cloud_generation_jobs where project_id=new.project_id and created_at>=date_trunc('month',now());
  if v_budget.monthly_credit_limit is not null and v_credits+coalesce(new.reserved_credits,0)>v_budget.monthly_credit_limit then raise exception 'cloud_project_credit_limit_exceeded';end if;
  if v_budget.monthly_cost_limit_micros is not null and v_cost+coalesce(new.reserved_cost_micros,new.estimated_cost_micros,0)>v_budget.monthly_cost_limit_micros then raise exception 'cloud_project_cost_limit_exceeded';end if;
  select coalesce(sum(byte_size),0) into v_storage from public.cloud_assets where project_id=new.project_id;
  if v_budget.storage_limit_bytes is not null and v_storage>=v_budget.storage_limit_bytes then raise exception 'cloud_project_storage_limit_exceeded';end if;
  return new;
end $$;
drop trigger if exists cloud_generation_jobs_project_budget on public.cloud_generation_jobs;
create trigger cloud_generation_jobs_project_budget before insert on public.cloud_generation_jobs
for each row execute function public.enforce_cloud_project_generation_budget();

create or replace function public.enforce_cloud_project_storage_budget()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_budget public.cloud_project_resource_budgets%rowtype;v_storage bigint;
begin
  select * into v_budget from public.cloud_project_resource_budgets where project_id=new.project_id for update;
  if not found or v_budget.storage_limit_bytes is null then return new;end if;
  select coalesce(sum(byte_size),0) into v_storage from public.cloud_assets where project_id=new.project_id and id<>new.id;
  if v_storage+new.byte_size>v_budget.storage_limit_bytes then raise exception 'cloud_project_storage_limit_exceeded';end if;
  return new;
end $$;
drop trigger if exists cloud_assets_project_storage_budget on public.cloud_assets;
create trigger cloud_assets_project_storage_budget before insert or update of byte_size,project_id on public.cloud_assets
for each row execute function public.enforce_cloud_project_storage_budget();

revoke all on function public.save_cloud_project_resource_budget(uuid,integer,bigint,bigint,integer,boolean),public.get_cloud_project_resource_usage(uuid) from public,anon;
grant execute on function public.save_cloud_project_resource_budget(uuid,integer,bigint,bigint,integer,boolean),public.get_cloud_project_resource_usage(uuid) to authenticated,service_role;

commit;
