begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'external-submission-quarantine','external-submission-quarantine',false,52428800,
  array['application/pdf','application/zip','application/x-zip-compressed','image/png','image/jpeg','image/webp']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'external-submission-pages','external-submission-pages',false,20971520,
  array['image/png']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.external_work_submission_files (
  id uuid primary key,
  submission_id uuid not null references public.external_work_submissions(id) on delete restrict,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique check(char_length(storage_path) between 10 and 500),
  original_name text not null check(char_length(original_name) between 1 and 255),
  declared_mime_type text not null check(declared_mime_type in(
    'application/pdf','application/zip','application/x-zip-compressed',
    'image/png','image/jpeg','image/webp'
  )),
  byte_size bigint not null check(byte_size between 1 and 52428800),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
  validation_status text not null default 'uploaded'
    check(validation_status in('uploaded','validating','validated','rejected')),
  malware_status text not null default 'pending'
    check(malware_status in('pending','clean','infected','unavailable')),
  error_code text check(error_code is null or error_code~'^[a-z0-9][a-z0-9._-]{0,63}$'),
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(submission_id,id),
  unique(submission_id,sha256)
);

create table if not exists public.external_work_submission_pages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.external_work_submissions(id) on delete restrict,
  source_file_id uuid not null,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  position integer not null check(position between 1 and 100),
  source_name text not null check(char_length(source_name) between 1 and 500),
  storage_path text not null unique check(char_length(storage_path) between 10 and 500),
  mime_type text not null check(mime_type='image/png'),
  byte_size bigint not null check(byte_size between 1 and 20971520),
  width integer not null check(width between 1 and 20000),
  height integer not null check(height between 1 and 20000),
  sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
  validation_status text not null default 'validated' check(validation_status='validated'),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(submission_id,source_file_id)
    references public.external_work_submission_files(submission_id,id) on delete restrict,
  constraint external_submission_pages_position_unique
    unique(submission_id,position) deferrable initially deferred,
  unique(submission_id,sha256)
);

create table if not exists public.external_submission_ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.external_work_submissions(id) on delete restrict,
  status text not null default 'queued' check(status in('queued','processing','succeeded','failed')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 10),
  max_attempts integer not null default 3 check(max_attempts between 1 and 10),
  worker_id text check(worker_id is null or char_length(worker_id) between 1 and 100),
  lease_token uuid,
  lease_expires_at timestamptz,
  retry_at timestamptz,
  error_code text check(error_code is null or error_code~'^[a-z0-9][a-z0-9._-]{0,63}$'),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_ingest_lease_pair check(
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  )
);

create index if not exists external_submission_files_submission_idx
on public.external_work_submission_files(submission_id,created_at);
create index if not exists external_submission_pages_submission_position_idx
on public.external_work_submission_pages(submission_id,position);
create index if not exists external_submission_ingest_queue_idx
on public.external_submission_ingest_jobs(status,retry_at,created_at)
where status in('queued','processing');

drop trigger if exists external_submission_files_touch_updated_at on public.external_work_submission_files;
create trigger external_submission_files_touch_updated_at before update
on public.external_work_submission_files for each row execute function public.touch_updated_at();
drop trigger if exists external_submission_pages_touch_updated_at on public.external_work_submission_pages;
create trigger external_submission_pages_touch_updated_at before update
on public.external_work_submission_pages for each row execute function public.touch_updated_at();
drop trigger if exists external_submission_ingest_jobs_touch_updated_at on public.external_submission_ingest_jobs;
create trigger external_submission_ingest_jobs_touch_updated_at before update
on public.external_submission_ingest_jobs for each row execute function public.touch_updated_at();

alter table public.external_work_submission_files enable row level security;
alter table public.external_work_submission_pages enable row level security;
alter table public.external_submission_ingest_jobs enable row level security;

drop policy if exists "external_submission_files_owner_read" on public.external_work_submission_files;
create policy "external_submission_files_owner_read" on public.external_work_submission_files
for select using(owner_profile_id=public.current_profile_id() or public.is_admin());
drop policy if exists "external_submission_pages_owner_read" on public.external_work_submission_pages;
create policy "external_submission_pages_owner_read" on public.external_work_submission_pages
for select using(owner_profile_id=public.current_profile_id() or public.is_admin());
drop policy if exists "external_submission_ingest_jobs_owner_read" on public.external_submission_ingest_jobs;
create policy "external_submission_ingest_jobs_owner_read" on public.external_submission_ingest_jobs
for select using(public.is_admin() or exists(
  select 1 from public.external_work_submissions submission
  where submission.id=submission_id and submission.owner_profile_id=public.current_profile_id()
));

revoke all on public.external_work_submission_files,
  public.external_work_submission_pages,public.external_submission_ingest_jobs
from public,anon,authenticated,service_role;
grant select on public.external_work_submission_files,
  public.external_work_submission_pages,public.external_submission_ingest_jobs
to authenticated,service_role;

drop policy if exists "external_submission_quarantine_insert" on storage.objects;
create policy "external_submission_quarantine_insert" on storage.objects
for insert to authenticated with check(
  bucket_id='external-submission-quarantine'
  and (storage.foldername(name))[1]=public.current_profile_id()::text
  and case
    when (storage.foldername(name))[2]~'^[0-9a-fA-F-]{36}$'
    then exists(
      select 1 from public.external_work_submissions submission
      where submission.id=((storage.foldername(name))[2])::uuid
        and submission.owner_profile_id=public.current_profile_id()
        and submission.status='uploading'
    )
    else false
  end
);
drop policy if exists "external_submission_quarantine_owner_delete" on storage.objects;
create policy "external_submission_quarantine_owner_delete" on storage.objects
for delete to authenticated using(
  bucket_id='external-submission-quarantine'
  and (storage.foldername(name))[1]=public.current_profile_id()::text
  and not exists(
    select 1 from public.external_work_submission_files upload
    where upload.storage_path=name
  )
);
drop policy if exists "external_submission_quarantine_owner_read" on storage.objects;
create policy "external_submission_quarantine_owner_read" on storage.objects
for select to authenticated using(
  bucket_id='external-submission-quarantine'
  and (storage.foldername(name))[1]=public.current_profile_id()::text
  and case
    when (storage.foldername(name))[2]~'^[0-9a-fA-F-]{36}$'
    then exists(
      select 1 from public.external_work_submissions submission
      where submission.id=((storage.foldername(name))[2])::uuid
        and submission.owner_profile_id=public.current_profile_id()
    )
    else false
  end
);
drop policy if exists "external_submission_pages_owner_read" on storage.objects;
create policy "external_submission_pages_owner_read" on storage.objects
for select to authenticated using(
  bucket_id='external-submission-pages'
  and (storage.foldername(name))[1]=public.current_profile_id()::text
  and case
    when (storage.foldername(name))[2]~'^[0-9a-fA-F-]{36}$'
    then exists(
      select 1 from public.external_work_submissions submission
      where submission.id=((storage.foldername(name))[2])::uuid
        and submission.owner_profile_id=public.current_profile_id()
    )
    else false
  end
);

alter table public.external_work_submission_events
drop constraint if exists external_work_submission_events_event_type_check;
alter table public.external_work_submission_events add constraint
external_work_submission_events_event_type_check check(event_type in(
  'created','rights_declared','status_changed','upload_registered',
  'validation_queued','validation_completed','validation_failed','pages_reordered'
));

create or replace function public.register_external_submission_upload(
  p_submission_id uuid,p_file_id uuid,p_storage_path text,p_original_name text,
  p_declared_mime_type text,p_byte_size bigint,p_sha256 text
) returns uuid language plpgsql security definer set search_path=public,storage,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;
begin
  select * into v_submission from public.external_work_submissions
  where id=p_submission_id and owner_profile_id=v_owner for update;
  if not found or v_submission.status<>'uploading' then raise exception 'external_upload_not_allowed';end if;
  if p_file_id is null
     or p_storage_path!~('^'||v_owner::text||'/'||p_submission_id::text||'/'||p_file_id::text||'-[a-zA-Z0-9._-]{1,200}$')
     or char_length(p_original_name) not between 1 and 255
     or p_declared_mime_type not in('application/pdf','application/zip','application/x-zip-compressed','image/png','image/jpeg','image/webp')
     or p_byte_size not between 1 and 52428800 or p_sha256!~'^[a-f0-9]{64}$' then
    raise exception 'external_upload_metadata_invalid';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='external-submission-quarantine' and name=p_storage_path) then
    raise exception 'external_upload_object_missing';
  end if;
  if (v_submission.source_format='pdf' and p_declared_mime_type<>'application/pdf')
     or (v_submission.source_format='zip' and p_declared_mime_type not in('application/zip','application/x-zip-compressed'))
     or (v_submission.source_format='images' and p_declared_mime_type not in('image/png','image/jpeg','image/webp')) then
    raise exception 'external_upload_format_mismatch';
  end if;
  if v_submission.source_format in('pdf','zip') and exists(
    select 1 from public.external_work_submission_files where submission_id=p_submission_id
  ) then raise exception 'external_upload_file_count_invalid';end if;
  if v_submission.source_format='images' and (
    select count(*) from public.external_work_submission_files where submission_id=p_submission_id
  )>=100 then raise exception 'external_upload_file_count_invalid';end if;
  if coalesce((
    select sum(byte_size) from public.external_work_submission_files where submission_id=p_submission_id
  ),0)+p_byte_size>524288000 then raise exception 'external_upload_quota_exceeded';end if;
  insert into public.external_work_submission_files(
    id,submission_id,owner_profile_id,storage_path,original_name,
    declared_mime_type,byte_size,sha256
  ) values(p_file_id,p_submission_id,v_owner,p_storage_path,p_original_name,
    p_declared_mime_type,p_byte_size,p_sha256);
  insert into public.external_work_submission_events(submission_id,actor_profile_id,event_type,from_status,to_status)
  values(p_submission_id,v_owner,'upload_registered','uploading','uploading');
  return p_file_id;
end$$;

create or replace function public.queue_external_submission_validation(p_submission_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_submission public.external_work_submissions%rowtype;v_job uuid;
begin
  select * into v_submission from public.external_work_submissions
  where id=p_submission_id and owner_profile_id=v_owner for update;
  if not found or v_submission.status<>'uploading' then raise exception 'external_validation_not_queueable';end if;
  if not exists(select 1 from public.external_work_submission_files where submission_id=p_submission_id)
     or (v_submission.source_format in('pdf','zip') and
       (select count(*) from public.external_work_submission_files where submission_id=p_submission_id)<>1) then
    raise exception 'external_upload_file_count_invalid';end if;
  insert into public.external_submission_ingest_jobs(submission_id,status)
  values(p_submission_id,'queued')
  on conflict(submission_id) do update set status='queued',attempt_count=0,worker_id=null,
    lease_token=null,lease_expires_at=null,retry_at=null,error_code=null,started_at=null,finished_at=null
  returning id into v_job;
  update public.external_work_submissions set status='validating',version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(submission_id,actor_profile_id,event_type,from_status,to_status)
  values(p_submission_id,v_owner,'validation_queued','uploading','validating');
  return v_job;
end$$;

create or replace function public.claim_external_submission_ingest(p_worker_id text,p_lease_seconds integer default 300)
returns table(job_id uuid,submission_id uuid,lease_token uuid,source_format text,owner_profile_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.external_submission_ingest_jobs%rowtype;v_token uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' or char_length(coalesce(p_worker_id,'')) not between 1 and 100
     or p_lease_seconds not between 30 and 900 then raise exception 'external_ingest_worker_invalid';end if;
  select * into v_job from public.external_submission_ingest_jobs job
  where (job.status='queued' and (job.retry_at is null or job.retry_at<=now()))
     or (job.status='processing' and job.lease_expires_at<now())
  order by job.created_at for update skip locked limit 1;
  if not found then return;end if;
  update public.external_submission_ingest_jobs set status='processing',attempt_count=attempt_count+1,
    worker_id=p_worker_id,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
    started_at=coalesce(started_at,now()),error_code=null where id=v_job.id;
  update public.external_work_submission_files set validation_status='validating'
  where external_work_submission_files.submission_id=v_job.submission_id;
  return query select v_job.id,v_job.submission_id,v_token,submission.source_format,submission.owner_profile_id
  from public.external_work_submissions submission where submission.id=v_job.submission_id;
end$$;

create or replace function public.complete_external_submission_ingest(
  p_job_id uuid,p_lease_token uuid,p_pages jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.external_submission_ingest_jobs%rowtype;v_submission public.external_work_submissions%rowtype;
begin
  if auth.role()<>'service_role' or jsonb_typeof(p_pages)<>'array'
     or jsonb_array_length(p_pages) not between 1 and 100 then raise exception 'external_ingest_completion_invalid';end if;
  select * into v_job from public.external_submission_ingest_jobs where id=p_job_id for update;
  if not found or v_job.status<>'processing' or v_job.lease_token<>p_lease_token
     or v_job.lease_expires_at<=now() then raise exception 'external_ingest_lease_invalid';end if;
  select * into v_submission from public.external_work_submissions where id=v_job.submission_id for update;
  if v_submission.status<>'validating' then raise exception 'external_ingest_submission_invalid';end if;
  delete from public.external_work_submission_pages where submission_id=v_job.submission_id;
  insert into public.external_work_submission_pages(
    id,submission_id,source_file_id,owner_profile_id,position,source_name,storage_path,
    mime_type,byte_size,width,height,sha256,validation_status
  )
  select (page->>'id')::uuid,v_job.submission_id,(page->>'sourceFileId')::uuid,
    v_submission.owner_profile_id,(page->>'position')::integer,page->>'sourceName',page->>'storagePath',
    'image/png',(page->>'byteSize')::bigint,(page->>'width')::integer,(page->>'height')::integer,
    page->>'sha256','validated'
  from jsonb_array_elements(p_pages) page;
  if (select count(*) from public.external_work_submission_pages where submission_id=v_job.submission_id)
     <>jsonb_array_length(p_pages)
     or exists(
       select 1 from generate_series(1,jsonb_array_length(p_pages)) expected
       left join public.external_work_submission_pages page
         on page.submission_id=v_job.submission_id and page.position=expected
       where page.id is null
     )
     or exists(
       select 1 from public.external_work_submission_pages page
       where page.submission_id=v_job.submission_id
         and (
           page.storage_path<>v_submission.owner_profile_id::text||'/'||v_job.submission_id::text||'/'||page.id::text||'.png'
           or not exists(
             select 1 from storage.objects object
             where object.bucket_id='external-submission-pages' and object.name=page.storage_path
           )
         )
     ) then raise exception 'external_ingest_pages_invalid';end if;
  update public.external_work_submission_files set validation_status='validated',malware_status='clean',
    error_code=null,scanned_at=now() where submission_id=v_job.submission_id;
  update public.external_submission_ingest_jobs set status='succeeded',lease_token=null,lease_expires_at=null,
    finished_at=now(),error_code=null where id=p_job_id;
  update public.external_work_submissions set status='ready',version=version+1 where id=v_job.submission_id;
  insert into public.external_work_submission_events(submission_id,event_type,from_status,to_status)
  values(v_job.submission_id,'validation_completed','validating','ready');
  return v_job.submission_id;
end$$;

create or replace function public.fail_external_submission_ingest(
  p_job_id uuid,p_lease_token uuid,p_error_code text,p_retryable boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.external_submission_ingest_jobs%rowtype;v_final boolean;
begin
  if auth.role()<>'service_role' or p_error_code!~'^[a-z0-9][a-z0-9._-]{0,63}$' then raise exception 'external_ingest_failure_invalid';end if;
  select * into v_job from public.external_submission_ingest_jobs where id=p_job_id for update;
  if not found or v_job.status<>'processing' or v_job.lease_token<>p_lease_token
     or v_job.lease_expires_at<=now() then raise exception 'external_ingest_lease_invalid';end if;
  v_final:=not p_retryable or v_job.attempt_count>=v_job.max_attempts;
  update public.external_submission_ingest_jobs set status=case when v_final then'failed'else'queued'end,
    lease_token=null,lease_expires_at=null,retry_at=case when v_final then null else now()+interval '1 minute'end,
    error_code=p_error_code,finished_at=case when v_final then now()else null end where id=p_job_id;
  update public.external_work_submission_files set validation_status=case when v_final then'rejected'else'uploaded'end,
    malware_status=case when p_error_code='malware_detected'then'infected'
      when p_error_code='malware_scan_unavailable'then'unavailable'else malware_status end,
    error_code=p_error_code,scanned_at=case when p_error_code like'malware_%'then now()else scanned_at end
  where submission_id=v_job.submission_id;
  if v_final then
    update public.external_work_submissions set status='rejected',review_reason_code=p_error_code,version=version+1
    where id=v_job.submission_id;
    insert into public.external_work_submission_events(submission_id,event_type,from_status,to_status,reason_code)
    values(v_job.submission_id,'validation_failed','validating','rejected',p_error_code);
  end if;
  return v_job.submission_id;
end$$;

create or replace function public.reorder_external_submission_pages(p_submission_id uuid,p_page_ids uuid[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=public.current_profile_id();v_count integer;
begin
  if not exists(select 1 from public.external_work_submissions where id=p_submission_id
      and owner_profile_id=v_owner and status in('ready','rejected') for update)
     or coalesce(array_length(p_page_ids,1),0) not between 1 and 100 then
    raise exception 'external_page_reorder_forbidden';end if;
  select count(*) into v_count from public.external_work_submission_pages where submission_id=p_submission_id;
  if v_count<>array_length(p_page_ids,1) or v_count<>(select count(distinct page_id) from unnest(p_page_ids) page_id)
     or exists(select 1 from unnest(p_page_ids) page_id where not exists(
       select 1 from public.external_work_submission_pages page where page.id=page_id and page.submission_id=p_submission_id
     )) then raise exception 'external_page_order_invalid';end if;
  set constraints external_submission_pages_position_unique deferred;
  update public.external_work_submission_pages page set position=ordered.position
  from unnest(p_page_ids) with ordinality ordered(page_id,position) where page.id=ordered.page_id;
  update public.external_work_submissions set version=version+1 where id=p_submission_id;
  insert into public.external_work_submission_events(submission_id,actor_profile_id,event_type,from_status,to_status)
  select id,v_owner,'pages_reordered',status,status from public.external_work_submissions where id=p_submission_id;
  return p_submission_id;
end$$;

revoke all on function public.register_external_submission_upload(uuid,uuid,text,text,text,bigint,text) from public,anon,authenticated,service_role;
revoke all on function public.queue_external_submission_validation(uuid) from public,anon,authenticated,service_role;
revoke all on function public.claim_external_submission_ingest(text,integer) from public,anon,authenticated,service_role;
revoke all on function public.complete_external_submission_ingest(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.fail_external_submission_ingest(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.reorder_external_submission_pages(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.register_external_submission_upload(uuid,uuid,text,text,text,bigint,text) to authenticated;
grant execute on function public.queue_external_submission_validation(uuid) to authenticated;
grant execute on function public.reorder_external_submission_pages(uuid,uuid[]) to authenticated;
grant execute on function public.claim_external_submission_ingest(text,integer) to service_role;
grant execute on function public.complete_external_submission_ingest(uuid,uuid,jsonb) to service_role;
grant execute on function public.fail_external_submission_ingest(uuid,uuid,text,boolean) to service_role;

commit;
