begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cloud-cache','cloud-cache',false,5242880,array['image/webp']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.cloud_page_thumbnails (
  page_id uuid primary key references public.cloud_pages(id) on delete cascade,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_revision bigint not null default 0 check(source_revision>=0),
  status text not null default 'queued' check(status in('queued','running','ready','failed')),
  bucket_id text not null default 'cloud-cache' check(bucket_id='cloud-cache'),
  storage_path text,
  width integer check(width is null or width between 1 and 640),
  height integer check(height is null or height between 1 and 960),
  attempt_count integer not null default 0 check(attempt_count>=0),
  max_attempts integer not null default 5 check(max_attempts between 1 and 10),
  lease_token uuid,
  lease_expires_at timestamptz,
  error_code text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cloud_storage_cleanup (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null check(bucket_id in('cloud-cache','cloud-exports')),
  storage_path text not null,
  reason text not null check(reason in('replaced_thumbnail','stale_thumbnail','export_intermediate','abandoned_export')),
  status text not null default 'pending' check(status in('pending','running','resolved','failed')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  max_attempts integer not null default 5 check(max_attempts between 1 and 10),
  not_before timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(bucket_id,storage_path)
);

create index cloud_page_thumbnails_claim_idx on public.cloud_page_thumbnails(status,updated_at) where status in('queued','running');
create index cloud_page_thumbnails_project_idx on public.cloud_page_thumbnails(project_id,page_id);
create index cloud_storage_cleanup_claim_idx on public.cloud_storage_cleanup(status,not_before) where status in('pending','running');
alter table public.cloud_page_thumbnails enable row level security;
alter table public.cloud_storage_cleanup enable row level security;
grant select on public.cloud_page_thumbnails to authenticated;
create policy "cloud_page_thumbnails_owner_read" on public.cloud_page_thumbnails for select using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));
create policy "cloud_cache_storage_read" on storage.objects for select using(
  bucket_id='cloud-cache'
  and (storage.foldername(name))[1]=public.current_profile_id()::text
  and case
    when (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then public.cloud_project_can_read(((storage.foldername(name))[2])::uuid)
    else false
  end
);

create or replace function public.queue_cloud_page_thumbnail() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_owner uuid;
begin
  select owner_profile_id into v_owner from public.cloud_projects where id=new.project_id;
  insert into public.cloud_page_thumbnails(page_id,project_id,owner_profile_id,source_revision,status,error_code,lease_token,lease_expires_at,updated_at)
  values(new.page_id,new.project_id,v_owner,new.revision,'queued',null,null,null,now())
  on conflict(page_id) do update set
    source_revision=excluded.source_revision,
    status=case when public.cloud_page_thumbnails.status='running' then 'running' else 'queued' end,
    error_code=null,
    lease_token=case when public.cloud_page_thumbnails.status='running' then public.cloud_page_thumbnails.lease_token else null end,
    lease_expires_at=case when public.cloud_page_thumbnails.status='running' then public.cloud_page_thumbnails.lease_expires_at else null end,
    updated_at=now()
  where public.cloud_page_thumbnails.source_revision<=excluded.source_revision;
  return new;
end$$;

create trigger cloud_canvas_snapshot_thumbnail_queue after insert on public.cloud_canvas_snapshots
for each row execute function public.queue_cloud_page_thumbnail();

insert into public.cloud_page_thumbnails(page_id,project_id,owner_profile_id,source_revision,status)
select page.id,page.project_id,project.owner_profile_id,page.revision,'queued'
from public.cloud_pages page join public.cloud_projects project on project.id=page.project_id
where page.deleted_at is null and project.deleted_at is null
on conflict(page_id) do nothing;

create or replace function public.claim_cloud_page_thumbnail(p_worker_id text,p_lease_seconds integer default 300)
returns setof public.cloud_page_thumbnails language plpgsql security definer set search_path=public as $$
declare v_page_id uuid;v_token uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 60 and 900 then raise exception 'cloud_thumbnail_worker_not_authorized';end if;
  select page_id into v_page_id from public.cloud_page_thumbnails
  where(status='queued' or(status='running' and lease_expires_at<=now())) and attempt_count<max_attempts
  order by updated_at for update skip locked limit 1;
  if v_page_id is null then return;end if;
  return query update public.cloud_page_thumbnails set status='running',attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),error_code=null,updated_at=now() where page_id=v_page_id returning *;
end$$;

create or replace function public.complete_cloud_page_thumbnail(p_page_id uuid,p_lease_token uuid,p_source_revision bigint,p_storage_path text,p_width integer,p_height integer)
returns text language plpgsql security definer set search_path=public as $$
declare v_row public.cloud_page_thumbnails%rowtype;v_old_path text;v_current_revision bigint;
begin
  if auth.role()<>'service_role' or p_storage_path is null or p_width not between 1 and 640 or p_height not between 1 and 960 then raise exception 'cloud_thumbnail_worker_not_authorized';end if;
  select * into v_row from public.cloud_page_thumbnails where page_id=p_page_id for update;
  select revision into v_current_revision from public.cloud_pages where id=p_page_id and deleted_at is null;
  if v_row.page_id is null or v_row.status<>'running' or v_row.lease_token<>p_lease_token then raise exception 'cloud_thumbnail_lease_invalid';end if;
  if v_current_revision is distinct from p_source_revision or v_row.source_revision is distinct from p_source_revision then
    insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason) values('cloud-cache',p_storage_path,'stale_thumbnail') on conflict(bucket_id,storage_path) do nothing;
    update public.cloud_page_thumbnails set status='queued',source_revision=coalesce(v_current_revision,source_revision),lease_token=null,lease_expires_at=null,updated_at=now() where page_id=p_page_id;
    return 'stale';
  end if;
  v_old_path:=v_row.storage_path;
  update public.cloud_page_thumbnails set status='ready',storage_path=p_storage_path,width=p_width,height=p_height,attempt_count=0,lease_token=null,lease_expires_at=null,error_code=null,generated_at=now(),updated_at=now() where page_id=p_page_id;
  if v_old_path is not null and v_old_path<>p_storage_path then insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason) values('cloud-cache',v_old_path,'replaced_thumbnail') on conflict(bucket_id,storage_path) do nothing;end if;
  return 'ready';
end$$;

create or replace function public.fail_cloud_page_thumbnail(p_page_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_row public.cloud_page_thumbnails%rowtype;v_retry boolean;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_thumbnail_worker_not_authorized';end if;
  select * into v_row from public.cloud_page_thumbnails where page_id=p_page_id for update;
  if v_row.page_id is null or v_row.status<>'running' or v_row.lease_token<>p_lease_token then raise exception 'cloud_thumbnail_lease_invalid';end if;
  v_retry:=p_retryable and v_row.attempt_count<v_row.max_attempts;
  update public.cloud_page_thumbnails set status=case when v_retry then 'queued' else 'failed' end,error_code=left(coalesce(p_error_code,'thumbnail_failed'),100),lease_token=null,lease_expires_at=null,updated_at=now() where page_id=p_page_id;
  return p_page_id;
end$$;

create or replace function public.queue_expired_cloud_storage_artifacts() returns integer
language plpgsql security definer set search_path=public as $$
declare v_count integer:=0;v_added integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_storage_cleanup_not_authorized';end if;
  insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before)
  select 'cloud-exports',path,'export_intermediate',now()
  from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id
  cross join lateral jsonb_array_elements_text(segment.page_storage_paths) path
  where job.status='completed' and job.finished_at<now()-interval '24 hours'
  on conflict(bucket_id,storage_path) do nothing;
  get diagnostics v_count=row_count;
  insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before)
  select 'cloud-exports',segment.pdf_storage_path,'export_intermediate',now()
  from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id
  where job.status='completed' and job.finished_at<now()-interval '24 hours'
  on conflict(bucket_id,storage_path) do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
  insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before)
  select 'cloud-exports',path,'abandoned_export',now()
  from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id
  cross join lateral jsonb_array_elements_text(segment.page_storage_paths) path
  where job.status in('failed','canceled') and job.finished_at<now()-interval '7 days'
  on conflict(bucket_id,storage_path) do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
  insert into public.cloud_storage_cleanup(bucket_id,storage_path,reason,not_before)
  select 'cloud-exports',segment.pdf_storage_path,'abandoned_export',now()
  from public.cloud_export_jobs job join public.cloud_export_segments segment on segment.job_id=job.id
  where job.status in('failed','canceled') and job.finished_at<now()-interval '7 days'
  on conflict(bucket_id,storage_path) do nothing;
  get diagnostics v_added=row_count;v_count:=v_count+v_added;
  return v_count;
end$$;

create or replace function public.claim_cloud_storage_cleanup(p_worker_id text,p_lease_seconds integer default 300)
returns setof public.cloud_storage_cleanup language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_token uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 60 and 900 then raise exception 'cloud_storage_cleanup_not_authorized';end if;
  select id into v_id from public.cloud_storage_cleanup where not_before<=now() and(status='pending' or(status='running' and lease_expires_at<=now())) and attempt_count<max_attempts order by not_before,created_at for update skip locked limit 1;
  if v_id is null then return;end if;
  return query update public.cloud_storage_cleanup set status='running',attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),error_code=null,updated_at=now() where id=v_id returning *;
end$$;

create or replace function public.complete_cloud_storage_cleanup(p_id uuid,p_lease_token uuid) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' then raise exception 'cloud_storage_cleanup_not_authorized';end if;
  update public.cloud_storage_cleanup set status='resolved',lease_token=null,lease_expires_at=null,error_code=null,resolved_at=now(),updated_at=now() where id=p_id and status='running' and lease_token=p_lease_token;
  if not found then raise exception 'cloud_storage_cleanup_lease_invalid';end if;
  return p_id;
end$$;

create or replace function public.fail_cloud_storage_cleanup(p_id uuid,p_lease_token uuid,p_error_code text) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' then raise exception 'cloud_storage_cleanup_not_authorized';end if;
  update public.cloud_storage_cleanup set status=case when attempt_count<max_attempts then 'pending' else 'failed' end,not_before=now()+interval '15 minutes',lease_token=null,lease_expires_at=null,error_code=left(coalesce(p_error_code,'storage_cleanup_failed'),100),updated_at=now() where id=p_id and status='running' and lease_token=p_lease_token;
  if not found then raise exception 'cloud_storage_cleanup_lease_invalid';end if;
  return p_id;
end$$;

revoke all on function public.claim_cloud_page_thumbnail(text,integer),public.complete_cloud_page_thumbnail(uuid,uuid,bigint,text,integer,integer),public.fail_cloud_page_thumbnail(uuid,uuid,text,boolean),public.queue_expired_cloud_storage_artifacts(),public.claim_cloud_storage_cleanup(text,integer),public.complete_cloud_storage_cleanup(uuid,uuid),public.fail_cloud_storage_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_cloud_page_thumbnail(text,integer),public.complete_cloud_page_thumbnail(uuid,uuid,bigint,text,integer,integer),public.fail_cloud_page_thumbnail(uuid,uuid,text,boolean),public.queue_expired_cloud_storage_artifacts(),public.claim_cloud_storage_cleanup(text,integer),public.complete_cloud_storage_cleanup(uuid,uuid),public.fail_cloud_storage_cleanup(uuid,uuid,text) to service_role;

commit;
