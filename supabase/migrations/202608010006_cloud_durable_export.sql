begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cloud-exports','cloud-exports',false,524288000,array['application/pdf','image/png','application/zip']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.cloud_export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  format text not null default 'pdf' check(format in('pdf')),
  status text not null default 'queued' check(status in('queued','running','paused','completed','failed','canceled')),
  page_ids uuid[] not null check(cardinality(page_ids) between 1 and 100),
  total_pages integer not null check(total_pages between 1 and 100),
  completed_pages integer not null default 0 check(completed_pages>=0 and completed_pages<=total_pages),
  segment_size integer not null default 4 check(segment_size between 1 and 8),
  progress integer not null default 0 check(progress between 0 and 100),
  output_bucket text check(output_bucket='cloud-exports'),
  output_storage_path text,
  output_byte_size bigint check(output_byte_size is null or output_byte_size>=0),
  attempt_count integer not null default 0 check(attempt_count>=0),
  max_attempts integer not null default 5 check(max_attempts between 1 and 10),
  lease_token uuid,
  lease_expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.cloud_export_segments (
  job_id uuid not null references public.cloud_export_jobs(id) on delete cascade,
  segment_index integer not null check(segment_index>=0),
  page_start integer not null check(page_start>=0),
  page_count integer not null check(page_count between 1 and 8),
  pdf_storage_path text not null,
  page_storage_paths jsonb not null default '[]'::jsonb check(jsonb_typeof(page_storage_paths)='array'),
  created_at timestamptz not null default now(),
  primary key(job_id,segment_index)
);

create index cloud_export_jobs_project_idx on public.cloud_export_jobs(project_id,created_at desc);
create index cloud_export_jobs_claim_idx on public.cloud_export_jobs(status,created_at) where status in('queued','running');
create unique index cloud_export_jobs_one_active_idx on public.cloud_export_jobs(project_id) where status in('queued','running','paused');
alter table public.cloud_export_jobs enable row level security;
alter table public.cloud_export_segments enable row level security;
grant select on public.cloud_export_jobs,public.cloud_export_segments to authenticated;

create policy "cloud_export_jobs_owner_read" on public.cloud_export_jobs for select using(
  created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(project_id)
);
create policy "cloud_export_segments_owner_read" on public.cloud_export_segments for select using(
  exists(select 1 from public.cloud_export_jobs job where job.id=job_id and job.created_by_profile_id=public.current_profile_id() and public.cloud_project_can_edit(job.project_id))
);

create or replace function public.create_cloud_export_job(p_project_id uuid,p_format text default 'pdf') returns uuid
language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id();v_page_ids uuid[];v_job_id uuid;v_context bigint;
begin
  if v_profile is null or p_format<>'pdf' or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_export_invalid';end if;
  select production_context_revision into v_context from public.cloud_projects where id=p_project_id and deleted_at is null;
  select array_agg(id order by page_number) into v_page_ids from public.cloud_pages where project_id=p_project_id and deleted_at is null;
  if coalesce(cardinality(v_page_ids),0) not between 1 and 100 then raise exception 'cloud_export_page_count_invalid';end if;
  if exists(select 1 from public.cloud_pages where project_id=p_project_id and deleted_at is null and(production_status<>'finalized' or finalized_revision is distinct from revision or reviewed_context_revision is distinct from v_context)) then raise exception 'cloud_export_pages_not_finalized';end if;
  if exists(select 1 from public.cloud_generation_jobs where project_id=p_project_id and status in('queued','running')) then raise exception 'cloud_export_generation_active';end if;
  if exists(select 1 from public.cloud_export_jobs where project_id=p_project_id and status in('queued','running','paused')) then raise exception 'cloud_export_already_active';end if;
  insert into public.cloud_export_jobs(project_id,created_by_profile_id,format,page_ids,total_pages) values(p_project_id,v_profile,p_format,v_page_ids,cardinality(v_page_ids)) returning id into v_job_id;
  return v_job_id;
end$$;

create or replace function public.set_cloud_export_job_state(p_job_id uuid,p_status text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_export_jobs%rowtype;
begin
  select * into v_job from public.cloud_export_jobs where id=p_job_id and created_by_profile_id=public.current_profile_id() for update;
  if v_job.id is null or p_status not in('queued','paused','canceled') then raise exception 'cloud_export_state_invalid';end if;
  if p_status='paused' and v_job.status not in('queued','running') then raise exception 'cloud_export_state_invalid';end if;
  if p_status='queued' and v_job.status not in('paused','failed') then raise exception 'cloud_export_state_invalid';end if;
  if p_status='canceled' and v_job.status not in('queued','running','paused','failed') then raise exception 'cloud_export_state_invalid';end if;
  update public.cloud_export_jobs set status=p_status,lease_token=null,lease_expires_at=null,error_code=null,finished_at=case when p_status='canceled' then now() else null end,updated_at=now() where id=v_job.id;
  return v_job.id;
end$$;

create or replace function public.claim_cloud_export_job(p_worker_id text,p_lease_seconds integer default 300)
returns setof public.cloud_export_jobs language plpgsql security definer set search_path=public as $$
declare v_job_id uuid;v_token uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 60 and 900 then raise exception 'cloud_export_worker_not_authorized';end if;
  select id into v_job_id from public.cloud_export_jobs where(status='queued' or(status='running' and lease_expires_at<=now())) and completed_pages<total_pages order by created_at for update skip locked limit 1;
  if v_job_id is null then return;end if;
  return query update public.cloud_export_jobs set status='running',attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),started_at=coalesce(started_at,now()),error_code=null,updated_at=now() where id=v_job_id returning *;
end$$;

create or replace function public.complete_cloud_export_segment(p_job_id uuid,p_lease_token uuid,p_segment_index integer,p_page_count integer,p_pdf_storage_path text,p_page_storage_paths jsonb,p_output_storage_path text default null,p_output_byte_size bigint default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_export_jobs%rowtype;v_completed integer;
begin
  if auth.role()<>'service_role' or jsonb_typeof(p_page_storage_paths)<>'array' or p_page_count not between 1 and 8 then raise exception 'cloud_export_worker_not_authorized';end if;
  select * into v_job from public.cloud_export_jobs where id=p_job_id for update;
  if v_job.id is null or v_job.status<>'running' or v_job.lease_token<>p_lease_token or p_segment_index<>floor(v_job.completed_pages::numeric/v_job.segment_size)::integer or p_page_count>v_job.total_pages-v_job.completed_pages then raise exception 'cloud_export_lease_invalid';end if;
  insert into public.cloud_export_segments(job_id,segment_index,page_start,page_count,pdf_storage_path,page_storage_paths) values(v_job.id,p_segment_index,v_job.completed_pages,p_page_count,p_pdf_storage_path,p_page_storage_paths) on conflict(job_id,segment_index) do update set page_start=excluded.page_start,page_count=excluded.page_count,pdf_storage_path=excluded.pdf_storage_path,page_storage_paths=excluded.page_storage_paths,created_at=now();
  v_completed:=v_job.completed_pages+p_page_count;
  if v_completed=v_job.total_pages and(p_output_storage_path is null or p_output_byte_size is null) then raise exception 'cloud_export_output_required';end if;
  update public.cloud_export_jobs set completed_pages=v_completed,progress=floor(v_completed*100.0/total_pages)::integer,status=case when v_completed=total_pages then 'completed' else 'queued' end,output_bucket=case when v_completed=total_pages then 'cloud-exports' else output_bucket end,output_storage_path=coalesce(p_output_storage_path,output_storage_path),output_byte_size=coalesce(p_output_byte_size,output_byte_size),attempt_count=0,lease_token=null,lease_expires_at=null,finished_at=case when v_completed=total_pages then now() else null end,updated_at=now() where id=v_job.id;
  return v_job.id;
end$$;

create or replace function public.fail_cloud_export_job(p_job_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_export_jobs%rowtype;v_retry boolean;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_export_worker_not_authorized';end if;
  select * into v_job from public.cloud_export_jobs where id=p_job_id for update;
  if v_job.id is null or v_job.status<>'running' or v_job.lease_token<>p_lease_token then raise exception 'cloud_export_lease_invalid';end if;
  v_retry:=p_retryable and v_job.attempt_count<v_job.max_attempts;
  update public.cloud_export_jobs set status=case when v_retry then 'queued' else 'failed' end,error_code=left(coalesce(p_error_code,'export_failed'),100),lease_token=null,lease_expires_at=null,finished_at=case when v_retry then null else now() end,updated_at=now() where id=v_job.id;
  return v_job.id;
end$$;

revoke all on function public.create_cloud_export_job(uuid,text),public.set_cloud_export_job_state(uuid,text),public.claim_cloud_export_job(text,integer),public.complete_cloud_export_segment(uuid,uuid,integer,integer,text,jsonb,text,bigint),public.fail_cloud_export_job(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.create_cloud_export_job(uuid,text),public.set_cloud_export_job_state(uuid,text) to authenticated,service_role;
grant execute on function public.claim_cloud_export_job(text,integer),public.complete_cloud_export_segment(uuid,uuid,integer,integer,text,jsonb,text,bigint),public.fail_cloud_export_job(uuid,uuid,text,boolean) to service_role;
commit;
