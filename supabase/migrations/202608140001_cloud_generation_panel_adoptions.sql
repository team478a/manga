begin;

create table public.cloud_generation_panel_adoptions (
  generation_job_id uuid primary key references public.cloud_generation_jobs(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  page_id uuid not null,
  panel_id uuid not null,
  asset_id uuid not null references public.cloud_assets(id) on delete restrict,
  source_page_revision bigint not null check(source_page_revision>=0),
  status text not null check(status in('auto_placed','review_required','placement_failed','rejected')),
  reason_code text check(reason_code is null or char_length(reason_code) between 1 and 100),
  retryable boolean not null default false,
  attempt_count integer not null default 1 check(attempt_count between 1 and 100),
  applied_page_revision bigint check(applied_page_revision is null or applied_page_revision>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade
);

create index cloud_generation_panel_adoptions_page_idx
  on public.cloud_generation_panel_adoptions(page_id,updated_at desc);
alter table public.cloud_generation_panel_adoptions enable row level security;
grant select on public.cloud_generation_panel_adoptions to authenticated;
grant select,insert,update,delete on public.cloud_generation_panel_adoptions to service_role;
create policy "cloud_generation_panel_adoptions_owner_read"
  on public.cloud_generation_panel_adoptions for select
  using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));

create or replace function public.find_pending_cloud_generation_panel_adoption()
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_panel_adoption_not_authorized';end if;
  select job.id into v_job_id
  from public.cloud_generation_jobs job
  join public.cloud_pages page on page.id=job.page_id and page.project_id=job.project_id
    and page.deleted_at is null
  join public.cloud_assets asset on asset.id=job.output_asset_id and asset.project_id=job.project_id
    and asset.owner_profile_id=job.created_by_profile_id
    and asset.source_generation_job_id=job.id and asset.deleted_at is null
  left join public.cloud_generation_batch_targets target on target.generation_job_id=job.id
  left join public.cloud_generation_panel_adoptions adoption on adoption.generation_job_id=job.id
  where job.kind='image' and job.status='completed' and job.page_id is not null
    and job.output_asset_id is not null
    and (target.id is not null or (
      coalesce(job.input->'autoAdopt','false'::jsonb)='true'::jsonb
      and job.input->>'candidateCount'='1'
      and coalesce(job.input->>'targetPanelId','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and coalesce(job.input->>'sourcePageRevision','')~'^[0-9]{1,18}$'
    ))
    and (adoption.generation_job_id is null or (
      adoption.status='placement_failed' and adoption.attempt_count<2
    ))
  order by job.updated_at,job.id
  limit 1;
  return v_job_id;
end $$;

create or replace function public.set_cloud_generation_panel_adoption_result(
  p_job_id uuid,
  p_status text,
  p_reason_code text default null,
  p_retryable boolean default false,
  p_applied_revision bigint default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_job public.cloud_generation_jobs%rowtype;
  v_target public.cloud_generation_batch_targets%rowtype;
  v_panel_id uuid;
  v_source_revision bigint;
begin
  if auth.role()<>'service_role' or p_status not in('auto_placed','review_required','placement_failed','rejected')
    or (p_reason_code is not null and char_length(p_reason_code) not between 1 and 100)
    or (p_applied_revision is not null and p_applied_revision<0) then
    raise exception 'cloud_panel_adoption_not_authorized';
  end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id;
  if v_job.id is null or v_job.kind<>'image' or v_job.status<>'completed'
    or v_job.page_id is null or v_job.output_asset_id is null then
    raise exception 'cloud_panel_adoption_job_invalid';
  end if;
  select * into v_target from public.cloud_generation_batch_targets
    where generation_job_id=v_job.id;
  if v_target.id is not null then
    if v_target.project_id<>v_job.project_id or v_target.page_id<>v_job.page_id
      or v_target.created_by_profile_id<>v_job.created_by_profile_id then
      raise exception 'cloud_panel_adoption_target_invalid';
    end if;
    v_panel_id:=v_target.panel_id;
    v_source_revision:=v_target.source_page_revision;
  else
    if coalesce(v_job.input->'autoAdopt','false'::jsonb)<>'true'::jsonb
      or coalesce(v_job.input->>'candidateCount','')<>'1'
      or coalesce(v_job.input->>'targetPanelId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_job.input->>'sourcePageRevision','')!~'^[0-9]{1,18}$' then
      raise exception 'cloud_panel_adoption_target_invalid';
    end if;
    v_panel_id:=(v_job.input->>'targetPanelId')::uuid;
    v_source_revision:=(v_job.input->>'sourcePageRevision')::bigint;
  end if;
  if not exists(select 1 from public.cloud_assets asset where asset.id=v_job.output_asset_id
    and asset.project_id=v_job.project_id and asset.owner_profile_id=v_job.created_by_profile_id
    and asset.source_generation_job_id=v_job.id and asset.deleted_at is null) then
    raise exception 'cloud_panel_adoption_asset_invalid';
  end if;
  insert into public.cloud_generation_panel_adoptions(
    generation_job_id,owner_profile_id,project_id,page_id,panel_id,asset_id,
    source_page_revision,status,reason_code,retryable,applied_page_revision
  ) values(
    v_job.id,v_job.created_by_profile_id,v_job.project_id,v_job.page_id,v_panel_id,
    v_job.output_asset_id,v_source_revision,p_status,p_reason_code,p_retryable,p_applied_revision
  ) on conflict(generation_job_id) do update set
    status=excluded.status,reason_code=excluded.reason_code,retryable=excluded.retryable,
    applied_page_revision=coalesce(excluded.applied_page_revision,public.cloud_generation_panel_adoptions.applied_page_revision),
    attempt_count=least(public.cloud_generation_panel_adoptions.attempt_count+1,100),updated_at=now()
  where public.cloud_generation_panel_adoptions.status<>'rejected' or excluded.status='rejected';
  return v_job.id;
end $$;

create or replace function public.save_cloud_generation_panel_adoption(
  p_job_id uuid,
  p_expected_revision bigint,
  p_canvas jsonb
) returns table(page_id uuid,revision bigint,updated_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_job public.cloud_generation_jobs%rowtype;
  v_target public.cloud_generation_batch_targets%rowtype;
  v_page public.cloud_pages%rowtype;
  v_panel_id uuid;
  v_source_revision bigint;
  v_existing_canvas jsonb;
  v_project_revision bigint;
  v_now timestamptz:=clock_timestamp();
begin
  if auth.role()<>'service_role' or jsonb_typeof(p_canvas)<>'object'
    or pg_column_size(p_canvas)>2097152 then
    raise exception 'cloud_panel_adoption_input_invalid';
  end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id for update;
  if v_job.id is null or v_job.kind<>'image' or v_job.status<>'completed'
    or v_job.page_id is null or v_job.output_asset_id is null then
    raise exception 'cloud_panel_adoption_job_invalid';
  end if;
  select * into v_target from public.cloud_generation_batch_targets
    where generation_job_id=v_job.id;
  if v_target.id is not null then
    if v_target.project_id<>v_job.project_id or v_target.page_id<>v_job.page_id
      or v_target.created_by_profile_id<>v_job.created_by_profile_id then
      raise exception 'cloud_panel_adoption_target_invalid';
    end if;
    v_panel_id:=v_target.panel_id;
    v_source_revision:=v_target.source_page_revision;
  else
    if coalesce(v_job.input->'autoAdopt','false'::jsonb)<>'true'::jsonb
      or coalesce(v_job.input->>'candidateCount','')<>'1'
      or coalesce(v_job.input->>'targetPanelId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_job.input->>'sourcePageRevision','')!~'^[0-9]{1,18}$' then
      raise exception 'cloud_panel_adoption_target_invalid';
    end if;
    v_panel_id:=(v_job.input->>'targetPanelId')::uuid;
    v_source_revision:=(v_job.input->>'sourcePageRevision')::bigint;
  end if;
  if exists(select 1 from public.cloud_generation_panel_adoptions adoption
    where adoption.generation_job_id=v_job.id and adoption.status='rejected') then
    raise exception 'cloud_panel_adoption_rejected';
  end if;
  select * into v_page from public.cloud_pages where id=v_job.page_id
    and project_id=v_job.project_id and deleted_at is null for update;
  if v_page.id is null then raise exception 'cloud_panel_adoption_page_invalid';end if;
  select snapshot.canvas into v_existing_canvas from public.cloud_canvas_snapshots snapshot
    where snapshot.page_id=v_page.id and snapshot.revision=v_page.revision;
  if v_existing_canvas is not null and exists(
    select 1 from jsonb_array_elements(coalesce(v_existing_canvas->'panelLayers','[]'::jsonb)) layer
    where layer->>'sourceJobId'=v_job.id::text
      or (layer->>'panelId'=v_panel_id::text and layer->>'assetId'=v_job.output_asset_id::text)
  ) then
    perform public.set_cloud_generation_panel_adoption_result(
      v_job.id,'auto_placed','already_applied',false,v_page.revision
    );
    page_id:=v_page.id;revision:=v_page.revision;updated_at:=v_page.updated_at;return next;return;
  end if;
  if v_page.production_status='finalized' then raise exception 'cloud_page_finalized';end if;
  if v_page.revision<>p_expected_revision then
    raise exception 'revision_conflict:%',v_page.revision;
  end if;
  if v_page.revision<>v_source_revision then
    raise exception 'source_revision_changed:%',v_page.revision;
  end if;
  if v_existing_canvas is null or not exists(
    select 1 from jsonb_array_elements(coalesce(v_existing_canvas->'panels','[]'::jsonb)) panel
    where panel->>'id'=v_panel_id::text
  ) then raise exception 'cloud_panel_adoption_panel_invalid';end if;
  if p_canvas->>'pageId'<>v_page.id::text or not exists(
    select 1 from jsonb_array_elements(coalesce(p_canvas->'panels','[]'::jsonb)) panel
    where panel->>'id'=v_panel_id::text
  ) or (select count(*) from jsonb_array_elements(coalesce(p_canvas->'panelLayers','[]'::jsonb)) layer
    where layer->>'panelId'=v_panel_id::text and layer->>'sourceJobId'=v_job.id::text
      and layer->>'assetId'=v_job.output_asset_id::text)<>1 then
    raise exception 'cloud_panel_adoption_canvas_invalid';
  end if;
  if not exists(select 1 from public.cloud_assets asset where asset.id=v_job.output_asset_id
    and asset.project_id=v_job.project_id and asset.owner_profile_id=v_job.created_by_profile_id
    and asset.source_generation_job_id=v_job.id and asset.deleted_at is null) then
    raise exception 'cloud_panel_adoption_asset_invalid';
  end if;

  update public.cloud_pages set revision=cloud_pages.revision+1,updated_at=v_now,
    production_status='review_required',production_status_updated_at=v_now
    where id=v_page.id returning cloud_pages.revision into revision;
  insert into public.cloud_canvas_snapshots(
    project_id,page_id,revision,canvas,created_by_profile_id,created_at
  ) values(v_page.project_id,v_page.id,revision,p_canvas,v_job.created_by_profile_id,v_now);
  update public.cloud_projects set revision=cloud_projects.revision+1,updated_at=v_now
    where id=v_page.project_id returning cloud_projects.revision into v_project_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id,created_at)
    values(v_page.project_id,v_project_revision,jsonb_build_object(
      'event','panel_auto_adopted','pageId',v_page.id,'panelId',v_panel_id,
      'pageRevision',revision,'generationJobId',v_job.id
    ),v_job.created_by_profile_id,v_now);
  perform public.set_cloud_generation_panel_adoption_result(
    v_job.id,'auto_placed',null,false,revision
  );
  page_id:=v_page.id;updated_at:=v_now;return next;
end $$;

revoke all on function public.set_cloud_generation_panel_adoption_result(uuid,text,text,boolean,bigint)
  from public,anon,authenticated;
revoke all on function public.save_cloud_generation_panel_adoption(uuid,bigint,jsonb)
  from public,anon,authenticated;
revoke all on function public.find_pending_cloud_generation_panel_adoption()
  from public,anon,authenticated;
grant execute on function public.set_cloud_generation_panel_adoption_result(uuid,text,text,boolean,bigint)
  to service_role;
grant execute on function public.save_cloud_generation_panel_adoption(uuid,bigint,jsonb)
  to service_role;
grant execute on function public.find_pending_cloud_generation_panel_adoption()
  to service_role;

notify pgrst, 'reload schema';
commit;
