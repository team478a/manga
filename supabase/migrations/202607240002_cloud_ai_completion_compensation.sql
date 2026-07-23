begin;

alter table public.cloud_assets
add column source_generation_job_id uuid
references public.cloud_generation_jobs(id) on delete set null;

create unique index cloud_assets_source_generation_job_idx
on public.cloud_assets(source_generation_job_id)
where source_generation_job_id is not null;

create table public.cloud_generation_storage_cleanup (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.cloud_generation_jobs(id) on delete set null,
  bucket_id text not null check (bucket_id = 'cloud-assets'),
  storage_path text not null check (char_length(storage_path) between 1 and 700),
  reason text not null check (char_length(reason) between 1 and 200),
  status text not null default 'pending' check (status in ('pending','resolved')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(bucket_id, storage_path)
);

alter table public.cloud_generation_storage_cleanup enable row level security;
revoke all on public.cloud_generation_storage_cleanup from public, anon, authenticated;
grant select, insert, update, delete on public.cloud_generation_storage_cleanup to service_role;

create or replace function public.complete_cloud_generation_image_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_asset_id uuid,
  p_storage_path text,
  p_file_name text,
  p_byte_size bigint,
  p_width integer,
  p_height integer,
  p_sha256 text,
  p_output jsonb,
  p_provider_job_id text,
  p_actual_cost_micros bigint
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_job public.cloud_generation_jobs%rowtype;
  v_existing_asset_id uuid;
begin
  if auth.role()<>'service_role' then
    raise exception 'cloud_worker_not_authorized';
  end if;
  select * into v_job
  from public.cloud_generation_jobs
  where id=p_job_id
  for update;
  if not found then
    raise exception 'cloud_generation_job_not_found';
  end if;
  select id into v_existing_asset_id
  from public.cloud_assets
  where source_generation_job_id=p_job_id;
  if v_job.status='completed'
     and v_existing_asset_id is not null
     and v_job.output_asset_id=v_existing_asset_id then
    return v_existing_asset_id;
  end if;
  if v_job.status<>'running' or v_job.lease_token<>p_lease_token then
    raise exception 'cloud_generation_lease_invalid';
  end if;
  if v_job.kind<>'image' or p_output->>'kind'<>'image'
     or p_output->>'assetId'<>p_asset_id::text then
    raise exception 'cloud_generation_output_asset_invalid';
  end if;
  insert into public.cloud_assets(
    id,project_id,owner_profile_id,storage_path,file_name,mime_type,
    byte_size,width,height,sha256,source_generation_job_id
  ) values (
    p_asset_id,v_job.project_id,v_job.created_by_profile_id,p_storage_path,
    left(p_file_name,255),'image/png',p_byte_size,p_width,p_height,p_sha256,p_job_id
  );
  perform public.finish_cloud_generation_job(
    p_job_id,p_lease_token,true,p_output,p_asset_id,p_provider_job_id,
    p_actual_cost_micros,null,null,false
  );
  return p_asset_id;
end;
$$;

create or replace function public.record_cloud_generation_storage_cleanup(
  p_job_id uuid,
  p_bucket_id text,
  p_storage_path text,
  p_reason text,
  p_last_error text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if auth.role()<>'service_role' then
    raise exception 'cloud_worker_not_authorized';
  end if;
  insert into public.cloud_generation_storage_cleanup(
    job_id,bucket_id,storage_path,reason,attempt_count,last_error
  ) values (
    p_job_id,p_bucket_id,p_storage_path,left(p_reason,200),1,left(p_last_error,500)
  )
  on conflict(bucket_id,storage_path) do update set
    job_id=excluded.job_id,
    reason=excluded.reason,
    status='pending',
    attempt_count=public.cloud_generation_storage_cleanup.attempt_count+1,
    last_error=excluded.last_error,
    updated_at=now(),
    resolved_at=null
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.queue_orphan_cloud_generation_assets()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_asset public.cloud_assets%rowtype;
  v_count integer := 0;
begin
  if auth.role()<>'service_role' then
    raise exception 'cloud_worker_not_authorized';
  end if;
  for v_asset in
    select asset.*
    from public.cloud_assets asset
    join public.cloud_generation_jobs job
      on job.id=asset.source_generation_job_id
    where asset.deleted_at is null
      and (
        job.status<>'completed'
        or job.output_asset_id is distinct from asset.id
      )
    limit 100
    for update of asset skip locked
  loop
    insert into public.cloud_generation_storage_cleanup(
      job_id,bucket_id,storage_path,reason
    ) values (
      v_asset.source_generation_job_id,'cloud-assets',v_asset.storage_path,
      'orphan_cloud_generation_asset'
    )
    on conflict(bucket_id,storage_path) do update set
      job_id=excluded.job_id,
      reason=excluded.reason,
      status='pending',
      updated_at=now(),
      resolved_at=null;
    update public.cloud_assets
    set deleted_at=now(),updated_at=now()
    where id=v_asset.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.complete_cloud_generation_image_job(
  uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint
) from public,anon,authenticated;
revoke execute on function public.record_cloud_generation_storage_cleanup(
  uuid,text,text,text,text
) from public,anon,authenticated;
revoke execute on function public.queue_orphan_cloud_generation_assets()
from public,anon,authenticated;
grant execute on function public.complete_cloud_generation_image_job(
  uuid,uuid,uuid,text,text,bigint,integer,integer,text,jsonb,text,bigint
) to service_role;
grant execute on function public.record_cloud_generation_storage_cleanup(
  uuid,text,text,text,text
) to service_role;
grant execute on function public.queue_orphan_cloud_generation_assets()
to service_role;

commit;
