begin;

create table public.cloud_generation_run_checkpoints (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null unique references public.cloud_generation_batch_targets(id) on delete cascade,
  batch_id uuid not null references public.cloud_generation_batches(id) on delete cascade,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  page_id uuid not null,
  panel_id uuid not null,
  source_page_revision integer not null check(source_page_revision>=0),
  job_id uuid not null unique references public.cloud_generation_jobs(id) on delete restrict,
  output_asset_id uuid not null unique references public.cloud_assets(id) on delete restrict,
  output_sha256 text not null check(output_sha256~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  foreign key(batch_id,project_id) references public.cloud_generation_batches(id,project_id) on delete cascade,
  foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade,
  foreign key(job_id,project_id) references public.cloud_generation_jobs(id,project_id) on delete restrict
);

create index cloud_generation_run_checkpoints_batch_idx on public.cloud_generation_run_checkpoints(batch_id,created_at);
alter table public.cloud_generation_run_checkpoints enable row level security;
grant select,insert on public.cloud_generation_run_checkpoints to service_role;

create or replace function public.record_cloud_generation_run_checkpoint(p_job_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_generation_jobs%rowtype;v_target public.cloud_generation_batch_targets%rowtype;v_asset public.cloud_assets%rowtype;v_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized';end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id and status='completed' and output_asset_id is not null;
  if not found then raise exception 'cloud_generation_checkpoint_job_invalid';end if;
  select * into v_target from public.cloud_generation_batch_targets where generation_job_id=v_job.id;
  if not found then return null;end if;
  select * into v_asset from public.cloud_assets where id=v_job.output_asset_id and project_id=v_job.project_id and deleted_at is null;
  if not found or v_asset.sha256 is null then raise exception 'cloud_generation_checkpoint_asset_invalid';end if;
  insert into public.cloud_generation_run_checkpoints(target_id,batch_id,project_id,page_id,panel_id,source_page_revision,job_id,output_asset_id,output_sha256)
  values(v_target.id,v_target.batch_id,v_target.project_id,v_target.page_id,v_target.panel_id,v_target.source_page_revision,v_job.id,v_asset.id,v_asset.sha256)
  on conflict(target_id) do update set target_id=excluded.target_id
  where cloud_generation_run_checkpoints.job_id=excluded.job_id and cloud_generation_run_checkpoints.output_asset_id=excluded.output_asset_id and cloud_generation_run_checkpoints.output_sha256=excluded.output_sha256
  returning id into v_id;
  if v_id is null then raise exception 'cloud_generation_checkpoint_conflict';end if;
  update public.cloud_generation_jobs set last_checkpoint_at=now(),updated_at=now() where id=v_job.id;
  return v_id;
end$$;

revoke all on function public.record_cloud_generation_run_checkpoint(uuid) from public,anon,authenticated;
grant execute on function public.record_cloud_generation_run_checkpoint(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
