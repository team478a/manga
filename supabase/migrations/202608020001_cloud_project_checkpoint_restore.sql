begin;

create table public.cloud_project_checkpoint_restores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  checkpoint_id uuid not null references public.cloud_project_checkpoints(id) on delete restrict,
  pre_restore_checkpoint_id uuid not null references public.cloud_project_checkpoints(id) on delete restrict,
  restored_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  result_project_revision bigint not null check(result_project_revision>=0),
  restored_at timestamptz not null default now()
);

create index cloud_project_checkpoint_restores_project_idx
  on public.cloud_project_checkpoint_restores(project_id,restored_at desc);
alter table public.cloud_project_checkpoint_restores enable row level security;
grant select on public.cloud_project_checkpoint_restores to authenticated;
grant select,insert on public.cloud_project_checkpoint_restores to service_role;
create policy "cloud_project_checkpoint_restores_read"
  on public.cloud_project_checkpoint_restores for select
  using(public.cloud_project_can_read(project_id));

create or replace function public.restore_cloud_project_checkpoint(p_project_id uuid,p_checkpoint_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_project public.cloud_projects%rowtype;
  v_checkpoint public.cloud_project_checkpoints%rowtype;
  v_manifest jsonb;
  v_project_json jsonb;
  v_item jsonb;
  v_canvas jsonb;
  v_page_revision bigint;
  v_project_revision bigint;
  v_pre_restore_checkpoint_id uuid;
  v_restore_id uuid:=gen_random_uuid();
  v_offset integer;
begin
  if v_profile is null then raise exception 'cloud_project_checkpoint_restore_invalid';end if;
  select * into v_project from public.cloud_projects where id=p_project_id and deleted_at is null for update;
  if not found or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_checkpoint_restore_not_editable';end if;
  select * into v_checkpoint from public.cloud_project_checkpoints where id=p_checkpoint_id and project_id=p_project_id;
  if not found then raise exception 'cloud_project_checkpoint_restore_not_found';end if;
  if exists(select 1 from public.cloud_generation_jobs where project_id=p_project_id and status in('queued','running')) then
    raise exception 'cloud_project_checkpoint_restore_generation_active';
  end if;
  if exists(select 1 from public.cloud_page_edit_locks where project_id=p_project_id and lease_expires_at>now()) then
    raise exception 'cloud_project_checkpoint_restore_page_locked';
  end if;

  v_manifest:=v_checkpoint.manifest;
  v_project_json:=v_manifest->'project';
  if coalesce(v_project_json->>'id','')<>p_project_id::text
     or jsonb_typeof(v_manifest->'chapters')<>'array'
     or jsonb_typeof(v_manifest->'episodes')<>'array'
     or jsonb_typeof(v_manifest->'scenes')<>'array'
     or jsonb_typeof(v_manifest->'pages')<>'array'
     or jsonb_array_length(v_manifest->'pages') not between 1 and 100 then
    raise exception 'cloud_project_checkpoint_restore_manifest_invalid';
  end if;

  v_pre_restore_checkpoint_id:=public.create_cloud_project_checkpoint(
    p_project_id,
    '復元前 '||left(v_checkpoint.label,90),
    'checkpoint'
  );

  select coalesce(max(order_index),0)+1000 into v_offset from public.cloud_chapters where project_id=p_project_id;
  update public.cloud_chapters set order_index=order_index+v_offset where project_id=p_project_id;
  select coalesce(max(order_index),0)+1000 into v_offset from public.cloud_episodes where project_id=p_project_id;
  update public.cloud_episodes set order_index=order_index+v_offset where project_id=p_project_id;
  select coalesce(max(order_index),0)+1000 into v_offset from public.cloud_scenes where project_id=p_project_id;
  update public.cloud_scenes set order_index=order_index+v_offset where project_id=p_project_id;
  select coalesce(max(order_index),0)+1000 into v_offset from public.cloud_pages where project_id=p_project_id;
  update public.cloud_pages set order_index=order_index+v_offset where project_id=p_project_id;

  update public.cloud_pages set deleted_at=now() where project_id=p_project_id
    and id not in(select (value->>'id')::uuid from jsonb_array_elements(v_manifest->'pages'));
  update public.cloud_scenes set deleted_at=now() where project_id=p_project_id
    and id not in(select (value->>'id')::uuid from jsonb_array_elements(v_manifest->'scenes'));
  update public.cloud_episodes set deleted_at=now() where project_id=p_project_id
    and id not in(select (value->>'id')::uuid from jsonb_array_elements(v_manifest->'episodes'));
  update public.cloud_chapters set deleted_at=now() where project_id=p_project_id
    and id not in(select (value->>'id')::uuid from jsonb_array_elements(v_manifest->'chapters'));

  for v_item in select value from jsonb_array_elements(v_manifest->'chapters') loop
    insert into public.cloud_chapters(id,project_id,title,order_index,revision,deleted_at)
    values((v_item->>'id')::uuid,p_project_id,v_item->>'title',(v_item->>'order_index')::integer,(v_item->>'revision')::bigint+1,null)
    on conflict(id) do update set title=excluded.title,order_index=excluded.order_index,revision=cloud_chapters.revision+1,deleted_at=null,updated_at=now()
    where cloud_chapters.project_id=p_project_id;
    if not found then raise exception 'cloud_project_checkpoint_restore_manifest_invalid';end if;
  end loop;
  for v_item in select value from jsonb_array_elements(v_manifest->'episodes') loop
    insert into public.cloud_episodes(id,project_id,chapter_id,title,order_index,revision,deleted_at)
    values((v_item->>'id')::uuid,p_project_id,(v_item->>'chapter_id')::uuid,v_item->>'title',(v_item->>'order_index')::integer,(v_item->>'revision')::bigint+1,null)
    on conflict(id) do update set chapter_id=excluded.chapter_id,title=excluded.title,order_index=excluded.order_index,revision=cloud_episodes.revision+1,deleted_at=null,updated_at=now()
    where cloud_episodes.project_id=p_project_id;
    if not found then raise exception 'cloud_project_checkpoint_restore_manifest_invalid';end if;
  end loop;
  for v_item in select value from jsonb_array_elements(v_manifest->'scenes') loop
    insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,summary,order_index,revision,deleted_at)
    values((v_item->>'id')::uuid,p_project_id,(v_item->>'chapter_id')::uuid,(v_item->>'episode_id')::uuid,v_item->>'title',coalesce(v_item->>'summary',''),(v_item->>'order_index')::integer,(v_item->>'revision')::bigint+1,null)
    on conflict(id) do update set chapter_id=excluded.chapter_id,episode_id=excluded.episode_id,title=excluded.title,summary=excluded.summary,order_index=excluded.order_index,revision=cloud_scenes.revision+1,deleted_at=null,updated_at=now()
    where cloud_scenes.project_id=p_project_id;
    if not found then raise exception 'cloud_project_checkpoint_restore_manifest_invalid';end if;
  end loop;
  for v_item in select value from jsonb_array_elements(v_manifest->'pages') loop
    insert into public.cloud_pages(id,project_id,episode_id,scene_id,page_number,order_index,width,height,background_color,revision,deleted_at,production_status,production_status_updated_at,production_status_updated_by_profile_id,finalized_revision,reviewed_context_revision)
    values((v_item->>'id')::uuid,p_project_id,(v_item->>'episodeId')::uuid,nullif(v_item->>'sceneId','')::uuid,(v_item->>'pageNumber')::integer,(v_item->>'orderIndex')::integer,(v_item->>'width')::integer,(v_item->>'height')::integer,v_item->>'backgroundColor',0,null,'revision_required',now(),v_profile,null,null)
    on conflict(id) do update set episode_id=excluded.episode_id,scene_id=excluded.scene_id,page_number=excluded.page_number,order_index=excluded.order_index,width=excluded.width,height=excluded.height,background_color=excluded.background_color,deleted_at=null,production_status='revision_required',production_status_updated_at=now(),production_status_updated_by_profile_id=v_profile,finalized_revision=null,reviewed_context_revision=null
    where cloud_pages.project_id=p_project_id;
    if not found then raise exception 'cloud_project_checkpoint_restore_manifest_invalid';end if;
    select canvas into v_canvas from public.cloud_project_backup_blobs
      where project_id=p_project_id and content_sha256=v_item->>'canvasSha256';
    if v_canvas is null then raise exception 'cloud_project_checkpoint_restore_blob_missing';end if;
    update public.cloud_pages set revision=revision+1,updated_at=now()
      where id=(v_item->>'id')::uuid returning revision into v_page_revision;
    insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id)
      values(p_project_id,(v_item->>'id')::uuid,v_page_revision,v_canvas,v_profile);
  end loop;

  update public.cloud_assets set deleted_at=now(),updated_at=now() where project_id=p_project_id
    and id not in(select (value->>'id')::uuid from jsonb_array_elements(coalesce(v_manifest->'assets','[]'::jsonb)));
  update public.cloud_assets set deleted_at=null,updated_at=now() where project_id=p_project_id
    and id in(select (value->>'id')::uuid from jsonb_array_elements(coalesce(v_manifest->'assets','[]'::jsonb)));
  update public.cloud_projects set
    title=coalesce(nullif(v_project_json->>'title',''),title),
    description=coalesce(v_project_json->>'description',''),
    reading_direction=coalesce(v_project_json->>'readingDirection',reading_direction),
    width=coalesce((v_project_json->>'width')::integer,width),
    height=coalesce((v_project_json->>'height')::integer,height),
    dpi=coalesce((v_project_json->>'dpi')::integer,dpi),
    cover_page_id=case
      when cloud_projects.cover_page_id is not null
        and exists(
          select 1
          from public.cloud_pages p
          where p.id=cloud_projects.cover_page_id
            and p.project_id=p_project_id
            and p.deleted_at is null
        )
      then cloud_projects.cover_page_id
      else null
    end,
    revision=revision+1,
    updated_at=now()
  where id=p_project_id returning revision into v_project_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id)
    values(p_project_id,v_project_revision,jsonb_build_object('event','checkpoint_restored','checkpointId',p_checkpoint_id,'preRestoreCheckpointId',v_pre_restore_checkpoint_id),v_profile);
  insert into public.cloud_project_checkpoint_restores(id,project_id,checkpoint_id,pre_restore_checkpoint_id,restored_by_profile_id,result_project_revision)
    values(v_restore_id,p_project_id,p_checkpoint_id,v_pre_restore_checkpoint_id,v_profile,v_project_revision);
  return v_restore_id;
end $$;

revoke all on function public.restore_cloud_project_checkpoint(uuid,uuid) from public,anon;
grant execute on function public.restore_cloud_project_checkpoint(uuid,uuid) to authenticated,service_role;

commit;
