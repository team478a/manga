begin;

create table public.cloud_page_dialogue_placements (
  page_id uuid primary key,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  storyboard_version_id uuid not null references public.cloud_story_storyboard_versions(id) on delete restrict,
  source_generation_job_id uuid not null references public.cloud_generation_jobs(id) on delete restrict,
  status text not null check(status in('auto_placed','review_required','placement_failed')),
  dialogue_count integer not null check(dialogue_count between 0 and 24),
  placed_dialogue_count integer not null check(placed_dialogue_count between 0 and dialogue_count),
  blocker_codes text[] not null default '{}',
  retryable boolean not null default false,
  attempt_count integer not null default 1 check(attempt_count between 1 and 100),
  applied_page_revision bigint check(applied_page_revision is null or applied_page_revision>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade,
  check(blocker_codes <@ array[
    'panel_missing','panel_locked','balloon_locked','text_locked','manual_text_present',
    'unlinked_existing_text','dialogue_does_not_fit','page_finalized'
  ]::text[])
);

create index cloud_page_dialogue_placements_project_idx
  on public.cloud_page_dialogue_placements(project_id,updated_at desc);
alter table public.cloud_page_dialogue_placements enable row level security;
grant select on public.cloud_page_dialogue_placements to authenticated;
grant select,insert,update,delete on public.cloud_page_dialogue_placements to service_role;
create policy "cloud_page_dialogue_placements_owner_read"
  on public.cloud_page_dialogue_placements for select
  using(owner_profile_id=public.current_profile_id() and public.cloud_project_can_read(project_id));

create or replace function public.cloud_page_images_ready_for_dialogue(p_job_id uuid)
returns boolean language plpgsql security definer stable set search_path=public,pg_temp as $$
declare
  v_job public.cloud_generation_jobs%rowtype;
  v_target public.cloud_generation_batch_targets%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_dialogue_not_authorized';end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id;
  if v_job.id is null or v_job.kind<>'image' or v_job.status<>'completed'
    or v_job.page_id is null then return false;end if;
  if not exists(select 1 from public.cloud_generation_panel_adoptions adoption
    where adoption.generation_job_id=v_job.id and adoption.status='auto_placed') then
    return false;
  end if;
  select * into v_target from public.cloud_generation_batch_targets
    where generation_job_id=v_job.id;
  if v_target.id is null then return true;end if;
  return not exists(
    select 1 from public.cloud_generation_batch_targets target
    left join public.cloud_generation_panel_adoptions adoption
      on adoption.generation_job_id=target.generation_job_id and adoption.status='auto_placed'
    where target.batch_id=v_target.batch_id and target.page_id=v_target.page_id
      and (target.generation_job_id is null or adoption.generation_job_id is null)
  );
end $$;

create or replace function public.find_pending_cloud_page_dialogue_placement()
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_dialogue_not_authorized';end if;
  select job.id into v_job_id
  from public.cloud_generation_jobs job
  join public.cloud_generation_panel_adoptions adoption
    on adoption.generation_job_id=job.id and adoption.status='auto_placed'
  join public.cloud_pages page on page.id=job.page_id and page.project_id=job.project_id
    and page.deleted_at is null and page.production_status<>'finalized'
  join public.cloud_story_storyboard_projects materialization
    on materialization.project_id=job.project_id
      and materialization.owner_profile_id=job.created_by_profile_id
  left join public.cloud_page_dialogue_placements placement on placement.page_id=page.id
  where job.kind='image' and job.status='completed'
    and (placement.page_id is null or (
      placement.status='placement_failed' and placement.retryable and placement.attempt_count<2
    ))
    and public.cloud_page_images_ready_for_dialogue(job.id)
  order by job.updated_at,job.id
  limit 1;
  return v_job_id;
end $$;

create or replace function public.set_cloud_page_dialogue_placement_result(
  p_job_id uuid,
  p_status text,
  p_dialogue_count integer,
  p_placed_dialogue_count integer,
  p_blocker_codes text[] default '{}',
  p_retryable boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_job public.cloud_generation_jobs%rowtype;
  v_storyboard_version_id uuid;
begin
  if auth.role()<>'service_role' or p_status not in('auto_placed','review_required','placement_failed')
    or p_dialogue_count not between 0 and 24
    or p_placed_dialogue_count not between 0 and p_dialogue_count
    or coalesce(p_blocker_codes,'{}') <@ array[
      'panel_missing','panel_locked','balloon_locked','text_locked','manual_text_present',
      'unlinked_existing_text','dialogue_does_not_fit','page_finalized'
    ]::text[] is not true then raise exception 'cloud_dialogue_input_invalid';end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id;
  if v_job.id is null or v_job.kind<>'image' or v_job.status<>'completed'
    or v_job.page_id is null then raise exception 'cloud_dialogue_job_invalid';end if;
  if not exists(select 1 from public.cloud_generation_panel_adoptions adoption
    where adoption.generation_job_id=v_job.id and adoption.status='auto_placed') then
    raise exception 'cloud_dialogue_image_not_placed';
  end if;
  select materialization.storyboard_version_id into v_storyboard_version_id
  from public.cloud_story_storyboard_projects materialization
  where materialization.project_id=v_job.project_id
    and materialization.owner_profile_id=v_job.created_by_profile_id;
  if v_storyboard_version_id is null then raise exception 'cloud_dialogue_storyboard_missing';end if;
  insert into public.cloud_page_dialogue_placements(
    page_id,owner_profile_id,project_id,storyboard_version_id,source_generation_job_id,
    status,dialogue_count,placed_dialogue_count,blocker_codes,retryable
  ) values(
    v_job.page_id,v_job.created_by_profile_id,v_job.project_id,v_storyboard_version_id,v_job.id,
    p_status,p_dialogue_count,p_placed_dialogue_count,coalesce(p_blocker_codes,'{}'),p_retryable
  ) on conflict(page_id) do update set
    source_generation_job_id=excluded.source_generation_job_id,status=excluded.status,
    dialogue_count=excluded.dialogue_count,placed_dialogue_count=excluded.placed_dialogue_count,
    blocker_codes=excluded.blocker_codes,retryable=excluded.retryable,
    attempt_count=least(public.cloud_page_dialogue_placements.attempt_count+1,100),updated_at=now();
  return v_job.page_id;
end $$;

create or replace function public.save_cloud_page_dialogue_placement(
  p_job_id uuid,
  p_expected_revision bigint,
  p_canvas jsonb,
  p_status text,
  p_dialogue_count integer,
  p_placed_dialogue_count integer,
  p_blocker_codes text[] default '{}'
) returns table(page_id uuid,revision bigint,updated_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_job public.cloud_generation_jobs%rowtype;
  v_page public.cloud_pages%rowtype;
  v_existing_canvas jsonb;
  v_storyboard_version_id uuid;
  v_project_revision bigint;
  v_now timestamptz:=clock_timestamp();
begin
  if auth.role()<>'service_role' or jsonb_typeof(p_canvas)<>'object'
    or pg_column_size(p_canvas)>2097152 or p_status not in('auto_placed','review_required')
    or p_dialogue_count not between 0 and 24
    or p_placed_dialogue_count not between 0 and p_dialogue_count
    or coalesce(p_blocker_codes,'{}') <@ array[
      'panel_missing','panel_locked','balloon_locked','text_locked','manual_text_present',
      'unlinked_existing_text','dialogue_does_not_fit','page_finalized'
    ]::text[] is not true then raise exception 'cloud_dialogue_input_invalid';end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id for update;
  if v_job.id is null or v_job.kind<>'image' or v_job.status<>'completed'
    or v_job.page_id is null then raise exception 'cloud_dialogue_job_invalid';end if;
  if not public.cloud_page_images_ready_for_dialogue(v_job.id) then
    raise exception 'page_images_not_ready';end if;
  select materialization.storyboard_version_id into v_storyboard_version_id
  from public.cloud_story_storyboard_projects materialization
  where materialization.project_id=v_job.project_id
    and materialization.owner_profile_id=v_job.created_by_profile_id;
  if v_storyboard_version_id is null then raise exception 'cloud_dialogue_storyboard_missing';end if;
  select * into v_page from public.cloud_pages where id=v_job.page_id
    and project_id=v_job.project_id and deleted_at is null for update;
  if v_page.id is null then raise exception 'cloud_dialogue_page_invalid';end if;
  if v_page.production_status='finalized' then raise exception 'cloud_page_finalized';end if;
  if v_page.revision<>p_expected_revision then raise exception 'revision_conflict:%',v_page.revision;end if;
  select snapshot.canvas into v_existing_canvas from public.cloud_canvas_snapshots snapshot
    where snapshot.page_id=v_page.id and snapshot.revision=v_page.revision;
  if v_existing_canvas is null or p_canvas->>'pageId'<>v_page.id::text
    or jsonb_typeof(p_canvas->'balloons')<>'array'
    or jsonb_typeof(p_canvas->'textObjects')<>'array'
    or (p_canvas-'balloons'-'textObjects')<>(v_existing_canvas-'balloons'-'textObjects')
    or exists(
      select 1 from jsonb_array_elements(p_canvas->'textObjects') text_object
      where text_object->>'parentBalloonId' is not null
        and not exists(select 1 from jsonb_array_elements(p_canvas->'balloons') balloon
          where balloon->>'id'=text_object->>'parentBalloonId')
    ) then raise exception 'cloud_dialogue_canvas_invalid';end if;

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
      'event','page_dialogue_auto_placed','pageId',v_page.id,
      'pageRevision',revision,'dialogueCount',p_dialogue_count,
      'placedDialogueCount',p_placed_dialogue_count
    ),v_job.created_by_profile_id,v_now);
  insert into public.cloud_page_dialogue_placements(
    page_id,owner_profile_id,project_id,storyboard_version_id,source_generation_job_id,
    status,dialogue_count,placed_dialogue_count,blocker_codes,retryable,applied_page_revision
  ) values(
    v_page.id,v_job.created_by_profile_id,v_job.project_id,v_storyboard_version_id,v_job.id,
    p_status,p_dialogue_count,p_placed_dialogue_count,coalesce(p_blocker_codes,'{}'),false,revision
  ) on conflict(page_id) do update set
    source_generation_job_id=excluded.source_generation_job_id,status=excluded.status,
    dialogue_count=excluded.dialogue_count,placed_dialogue_count=excluded.placed_dialogue_count,
    blocker_codes=excluded.blocker_codes,retryable=false,applied_page_revision=excluded.applied_page_revision,
    attempt_count=least(public.cloud_page_dialogue_placements.attempt_count+1,100),updated_at=v_now;
  page_id:=v_page.id;updated_at:=v_now;return next;
end $$;

revoke all on function public.cloud_page_images_ready_for_dialogue(uuid) from public,anon,authenticated;
revoke all on function public.find_pending_cloud_page_dialogue_placement() from public,anon,authenticated;
revoke all on function public.set_cloud_page_dialogue_placement_result(uuid,text,integer,integer,text[],boolean) from public,anon,authenticated;
revoke all on function public.save_cloud_page_dialogue_placement(uuid,bigint,jsonb,text,integer,integer,text[]) from public,anon,authenticated;
grant execute on function public.cloud_page_images_ready_for_dialogue(uuid) to service_role;
grant execute on function public.find_pending_cloud_page_dialogue_placement() to service_role;
grant execute on function public.set_cloud_page_dialogue_placement_result(uuid,text,integer,integer,text[],boolean) to service_role;
grant execute on function public.save_cloud_page_dialogue_placement(uuid,bigint,jsonb,text,integer,integer,text[]) to service_role;

notify pgrst, 'reload schema';
commit;
