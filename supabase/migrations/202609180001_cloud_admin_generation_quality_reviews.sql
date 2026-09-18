begin;

create table public.cloud_admin_generation_quality_reviews (
  generation_job_id uuid primary key references public.cloud_generation_jobs(id) on delete cascade,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  asset_id uuid not null references public.cloud_assets(id) on delete restrict,
  reviewer_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null check(status in('approved','needs_review','quality_issue')),
  note text not null default '' check(char_length(note)<=1000),
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(generation_job_id,project_id)
    references public.cloud_generation_jobs(id,project_id) on delete cascade
);

create index cloud_admin_generation_quality_reviews_status_idx
  on public.cloud_admin_generation_quality_reviews(status,reviewed_at desc);

alter table public.cloud_admin_generation_quality_reviews enable row level security;
grant select on public.cloud_admin_generation_quality_reviews to authenticated;
grant select,insert,update on public.cloud_admin_generation_quality_reviews to service_role;

create policy "cloud_admin_generation_quality_reviews_admin_read"
  on public.cloud_admin_generation_quality_reviews for select
  using(public.is_admin());

create or replace function public.review_cloud_admin_generation_quality(
  p_generation_job_id uuid,
  p_status text,
  p_note text default ''
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid:=public.current_profile_id();
  v_job public.cloud_generation_jobs%rowtype;
  v_before_status text;
  v_now timestamptz:=clock_timestamp();
begin
  if v_actor is null
    or not exists(select 1 from public.profiles where id=v_actor and role='admin')
    or p_status not in('approved','needs_review','quality_issue')
    or char_length(coalesce(p_note,''))>1000
  then
    raise exception 'cloud_admin_generation_quality_review_invalid';
  end if;

  select * into v_job
  from public.cloud_generation_jobs
  where id=p_generation_job_id
  for update;

  if v_job.id is null or v_job.kind<>'image' or v_job.status<>'completed'
    or v_job.output_asset_id is null
    or not exists(
      select 1 from public.cloud_assets asset
      where asset.id=v_job.output_asset_id
        and asset.project_id=v_job.project_id
        and asset.source_generation_job_id=v_job.id
        and asset.deleted_at is null
    )
  then
    raise exception 'cloud_admin_generation_quality_review_target_invalid';
  end if;

  select status into v_before_status
  from public.cloud_admin_generation_quality_reviews
  where generation_job_id=v_job.id;

  insert into public.cloud_admin_generation_quality_reviews(
    generation_job_id,project_id,asset_id,reviewer_profile_id,status,note,reviewed_at,updated_at
  ) values(
    v_job.id,v_job.project_id,v_job.output_asset_id,v_actor,p_status,coalesce(p_note,''),v_now,v_now
  )
  on conflict(generation_job_id) do update set
    project_id=excluded.project_id,
    asset_id=excluded.asset_id,
    reviewer_profile_id=excluded.reviewer_profile_id,
    status=excluded.status,
    note=excluded.note,
    reviewed_at=excluded.reviewed_at,
    updated_at=excluded.updated_at;

  insert into public.cloud_ai_admin_audit_logs(
    actor_profile_id,action,target_type,target_id,before_value,after_value
  ) values(
    v_actor,'generation_quality_reviewed','cloud_generation_job',v_job.id::text,
    case when v_before_status is null then null else jsonb_build_object('status',v_before_status) end,
    jsonb_build_object('status',p_status,'reviewedAt',v_now)
  );

  return v_job.id;
end$$;

revoke all on function public.review_cloud_admin_generation_quality(uuid,text,text)
  from public,anon;
grant execute on function public.review_cloud_admin_generation_quality(uuid,text,text)
  to authenticated,service_role;

notify pgrst, 'reload schema';
commit;
