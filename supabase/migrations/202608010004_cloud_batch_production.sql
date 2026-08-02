begin;

create table public.cloud_generation_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  requested_page_ids uuid[] not null check (cardinality(requested_page_ids) between 4 and 8),
  status text not null default 'active' check (status in ('active','paused','completed','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(created_by_profile_id,idempotency_key),
  unique(id,project_id)
);

create table public.cloud_generation_batch_jobs (
  batch_id uuid not null references public.cloud_generation_batches(id) on delete cascade,
  project_id uuid not null,
  page_id uuid not null,
  job_id uuid not null references public.cloud_generation_jobs(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(batch_id,job_id),
  foreign key(batch_id,project_id) references public.cloud_generation_batches(id,project_id) on delete cascade,
  foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade
);

create table public.cloud_page_edit_locks (
  page_id uuid primary key,
  project_id uuid not null,
  locked_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  lock_token uuid not null,
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade
);

create index cloud_generation_batches_project_idx on public.cloud_generation_batches(project_id,created_at desc);
create index cloud_generation_batch_jobs_page_idx on public.cloud_generation_batch_jobs(page_id,created_at desc);
create index cloud_page_edit_locks_project_idx on public.cloud_page_edit_locks(project_id,lease_expires_at);

alter table public.cloud_generation_batches enable row level security;
alter table public.cloud_generation_batch_jobs enable row level security;
alter table public.cloud_page_edit_locks enable row level security;
grant select on public.cloud_generation_batches,public.cloud_generation_batch_jobs,public.cloud_page_edit_locks to authenticated;

create policy "cloud_generation_batches_owner_read" on public.cloud_generation_batches for select
  using(created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id));
create policy "cloud_generation_batch_jobs_owner_read" on public.cloud_generation_batch_jobs for select
  using(public.cloud_project_can_edit(project_id));
create policy "cloud_page_edit_locks_editor_read" on public.cloud_page_edit_locks for select
  using(public.cloud_project_can_edit(project_id));

create or replace function public.create_cloud_generation_batch(
  p_project_id uuid,p_page_ids uuid[],p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id();v_batch uuid;v_distinct integer;
begin
  if v_profile is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_batch_not_editable';end if;
  select count(distinct page_id) into v_distinct from unnest(p_page_ids) page_id;
  if cardinality(p_page_ids) not between 4 and 8 or v_distinct<>cardinality(p_page_ids)
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 200 then raise exception 'cloud_batch_invalid';end if;
  if (select count(*) from public.cloud_pages where project_id=p_project_id and id=any(p_page_ids) and deleted_at is null)<>cardinality(p_page_ids) then raise exception 'cloud_batch_pages_invalid';end if;
  insert into public.cloud_generation_batches(project_id,created_by_profile_id,idempotency_key,requested_page_ids)
  values(p_project_id,v_profile,trim(p_idempotency_key),p_page_ids)
  on conflict(created_by_profile_id,idempotency_key) do update set updated_at=public.cloud_generation_batches.updated_at
  returning id into v_batch;
  return v_batch;
end $$;

create or replace function public.attach_cloud_generation_batch_job(p_batch_id uuid,p_job_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_batch public.cloud_generation_batches%rowtype;v_job public.cloud_generation_jobs%rowtype;
begin
  select * into v_batch from public.cloud_generation_batches where id=p_batch_id and created_by_profile_id=public.current_profile_id();
  select * into v_job from public.cloud_generation_jobs where id=p_job_id and created_by_profile_id=public.current_profile_id();
  if v_batch.id is null or v_job.id is null or v_job.project_id<>v_batch.project_id or v_job.page_id is null or not(v_job.page_id=any(v_batch.requested_page_ids)) then raise exception 'cloud_batch_job_invalid';end if;
  insert into public.cloud_generation_batch_jobs(batch_id,project_id,page_id,job_id) values(v_batch.id,v_batch.project_id,v_job.page_id,v_job.id) on conflict do nothing;
  return v_job.id;
end $$;

create or replace function public.replace_cloud_generation_batch_job(p_failed_job_id uuid,p_new_job_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_failed public.cloud_generation_jobs%rowtype;v_new public.cloud_generation_jobs%rowtype;v_count integer;
begin
  select * into v_failed from public.cloud_generation_jobs where id=p_failed_job_id and created_by_profile_id=public.current_profile_id() and status='failed';
  select * into v_new from public.cloud_generation_jobs where id=p_new_job_id and created_by_profile_id=public.current_profile_id();
  if v_failed.id is null or v_new.id is null or v_new.status<>'queued' or v_failed.project_id<>v_new.project_id or v_failed.page_id is distinct from v_new.page_id then raise exception 'cloud_batch_retry_invalid';end if;
  insert into public.cloud_generation_batch_jobs(batch_id,project_id,page_id,job_id)
  select link.batch_id,link.project_id,link.page_id,v_new.id
  from public.cloud_generation_batch_jobs link
  join public.cloud_generation_batches batch on batch.id=link.batch_id
  where link.job_id=v_failed.id and batch.status in('active','paused')
  on conflict do nothing;
  get diagnostics v_count=row_count;
  if v_count>0 then delete from public.cloud_generation_batch_jobs where job_id=v_failed.id;end if;
  return v_count;
end $$;

create or replace function public.set_cloud_generation_batch_state(p_batch_id uuid,p_status text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_batch public.cloud_generation_batches%rowtype;v_job record;
begin
  select * into v_batch from public.cloud_generation_batches where id=p_batch_id and created_by_profile_id=public.current_profile_id() for update;
  if v_batch.id is null or p_status not in('active','paused','canceled') then raise exception 'cloud_batch_not_editable';end if;
  if p_status='canceled' then
    for v_job in select job_id from public.cloud_generation_batch_jobs where batch_id=v_batch.id loop
      begin perform public.cancel_cloud_generation_job(v_job.job_id); exception when others then null; end;
    end loop;
  end if;
  update public.cloud_generation_batches set status=p_status,updated_at=now() where id=v_batch.id;
  return v_batch.id;
end $$;

create or replace function public.acquire_cloud_page_edit_lock(p_page_id uuid,p_lock_token uuid,p_lease_seconds integer default 120)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare v_page public.cloud_pages%rowtype;v_profile uuid:=public.current_profile_id();v_expires timestamptz;
begin
  select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null;
  if v_page.id is null or v_profile is null or not public.cloud_project_can_edit(v_page.project_id) or p_lease_seconds not between 60 and 300 then raise exception 'cloud_page_lock_invalid';end if;
  insert into public.cloud_page_edit_locks(page_id,project_id,locked_by_profile_id,lock_token,lease_expires_at)
  values(v_page.id,v_page.project_id,v_profile,p_lock_token,now()+make_interval(secs=>p_lease_seconds))
  on conflict(page_id) do update set locked_by_profile_id=excluded.locked_by_profile_id,lock_token=excluded.lock_token,lease_expires_at=excluded.lease_expires_at,updated_at=now()
  where public.cloud_page_edit_locks.lease_expires_at<=now() or (public.cloud_page_edit_locks.locked_by_profile_id=v_profile and public.cloud_page_edit_locks.lock_token=p_lock_token)
  returning lease_expires_at into v_expires;
  if v_expires is null then raise exception 'cloud_page_locked';end if;
  return v_expires;
end $$;

create or replace function public.release_cloud_page_edit_lock(p_page_id uuid,p_lock_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  delete from public.cloud_page_edit_locks where page_id=p_page_id and locked_by_profile_id=public.current_profile_id() and lock_token=p_lock_token;
  return found;
end $$;

-- Paused batches remain durable, but their queued jobs are not claimed.
create or replace function public.claim_cloud_generation_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.cloud_generation_jobs language plpgsql security definer set search_path=public as $$
declare v_job_id uuid;v_token uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 30 and 900 then raise exception 'cloud_worker_not_authorized';end if;
  select job.id into v_job_id from public.cloud_generation_jobs job
  where ((job.status='queued' and(job.retry_at is null or job.retry_at<=now())) or(job.status='running' and job.lease_expires_at<=now()))
    and not exists(select 1 from public.cloud_generation_batch_jobs link join public.cloud_generation_batches batch on batch.id=link.batch_id where link.job_id=job.id and batch.status in('paused','canceled'))
  order by job.created_at for update of job skip locked limit 1;
  if v_job_id is null then return;end if;
  return query update public.cloud_generation_jobs set status='running',progress=1,attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),started_at=coalesce(started_at,now()),updated_at=now() where id=v_job_id returning *;
end $$;

revoke all on function public.create_cloud_generation_batch(uuid,uuid[],text) from public,anon;
revoke all on function public.attach_cloud_generation_batch_job(uuid,uuid) from public,anon;
revoke all on function public.replace_cloud_generation_batch_job(uuid,uuid) from public,anon;
revoke all on function public.set_cloud_generation_batch_state(uuid,text) from public,anon;
revoke all on function public.acquire_cloud_page_edit_lock(uuid,uuid,integer) from public,anon;
revoke all on function public.release_cloud_page_edit_lock(uuid,uuid) from public,anon;
grant execute on function public.create_cloud_generation_batch(uuid,uuid[],text) to authenticated,service_role;
grant execute on function public.attach_cloud_generation_batch_job(uuid,uuid) to authenticated,service_role;
grant execute on function public.replace_cloud_generation_batch_job(uuid,uuid) to authenticated,service_role;
grant execute on function public.set_cloud_generation_batch_state(uuid,text) to authenticated,service_role;
grant execute on function public.acquire_cloud_page_edit_lock(uuid,uuid,integer) to authenticated,service_role;
grant execute on function public.release_cloud_page_edit_lock(uuid,uuid) to authenticated,service_role;

commit;
