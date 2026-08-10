begin;

create or replace function public.create_cloud_project_checkpoint(p_project_id uuid,p_label text,p_kind text default 'checkpoint')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_project public.cloud_projects%rowtype;
  v_page record;
  v_canvas jsonb;
  v_canvas_hash text;
  v_pages jsonb:='[]'::jsonb;
  v_manifest jsonb;
  v_manifest_hash text;
  v_checkpoint_id uuid:=gen_random_uuid();
  v_page_count integer;
  v_item jsonb;
begin
  if v_profile is null or p_kind not in('checkpoint','release') or char_length(trim(coalesce(p_label,''))) not between 1 and 100 then
    raise exception 'cloud_project_checkpoint_invalid';
  end if;
  select * into v_project from public.cloud_projects where id=p_project_id and deleted_at is null for share;
  if not found or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_checkpoint_not_editable';end if;
  select count(*) into v_page_count from public.cloud_pages where project_id=p_project_id and deleted_at is null;
  if v_page_count not between 1 and 100 then raise exception 'cloud_project_checkpoint_page_count_invalid';end if;
  if exists(select 1 from public.cloud_generation_jobs where project_id=p_project_id and status in('queued','running')) then raise exception 'cloud_project_checkpoint_generation_active';end if;
  if p_kind='release' and exists(
    select 1 from public.cloud_pages where project_id=p_project_id and deleted_at is null
    and(production_status<>'finalized' or finalized_revision is distinct from revision or reviewed_context_revision is distinct from v_project.production_context_revision)
  ) then raise exception 'cloud_project_checkpoint_pages_not_finalized';end if;

  for v_page in select * from public.cloud_pages where project_id=p_project_id and deleted_at is null order by page_number,id loop
    select canvas into v_canvas from public.cloud_canvas_snapshots where project_id=p_project_id and page_id=v_page.id order by revision desc limit 1;
    if v_canvas is null then raise exception 'cloud_project_checkpoint_snapshot_missing';end if;
    v_canvas_hash:=encode(extensions.digest(convert_to(v_canvas::text,'UTF8'),'sha256'),'hex');
    insert into public.cloud_project_backup_blobs(project_id,content_sha256,canvas,byte_size)
    values(p_project_id,v_canvas_hash,v_canvas,pg_column_size(v_canvas)) on conflict(project_id,content_sha256) do nothing;
    v_pages:=v_pages||jsonb_build_array(jsonb_build_object(
      'id',v_page.id,'episodeId',v_page.episode_id,'sceneId',v_page.scene_id,'pageNumber',v_page.page_number,
      'orderIndex',v_page.order_index,'revision',v_page.revision,'width',v_page.width,'height',v_page.height,
      'backgroundColor',v_page.background_color,'productionStatus',v_page.production_status,'canvasSha256',v_canvas_hash
    ));
  end loop;

  v_manifest:=jsonb_build_object(
    'schemaVersion',1,
    'project',jsonb_build_object('id',v_project.id,'title',v_project.title,'description',v_project.description,'revision',v_project.revision,'productionContextRevision',v_project.production_context_revision,'width',v_project.width,'height',v_project.height,'dpi',v_project.dpi,'readingDirection',v_project.reading_direction),
    'chapters',coalesce((select jsonb_agg(to_jsonb(c) order by c.order_index,c.id) from public.cloud_chapters c where c.project_id=p_project_id and c.deleted_at is null),'[]'::jsonb),
    'episodes',coalesce((select jsonb_agg(to_jsonb(e) order by e.order_index,e.id) from public.cloud_episodes e where e.project_id=p_project_id and e.deleted_at is null),'[]'::jsonb),
    'scenes',coalesce((select jsonb_agg(to_jsonb(s) order by s.order_index,s.id) from public.cloud_scenes s where s.project_id=p_project_id and s.deleted_at is null),'[]'::jsonb),
    'pages',v_pages,
    'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'sha256',a.sha256,'storagePath',a.storage_path,'byteSize',a.byte_size,'width',a.width,'height',a.height) order by a.created_at,a.id) from public.cloud_assets a where a.project_id=p_project_id and a.deleted_at is null),'[]'::jsonb)
  );
  v_manifest_hash:=encode(extensions.digest(convert_to(v_manifest::text,'UTF8'),'sha256'),'hex');
  insert into public.cloud_project_checkpoints(id,project_id,created_by_profile_id,kind,label,project_revision,production_context_revision,page_count,manifest,manifest_sha256)
  values(v_checkpoint_id,p_project_id,v_profile,p_kind,trim(p_label),v_project.revision,v_project.production_context_revision,v_page_count,v_manifest,v_manifest_hash);
  for v_item in select value from jsonb_array_elements(v_pages) loop
    insert into public.cloud_project_checkpoint_pages(checkpoint_id,project_id,page_id,page_number,page_revision,canvas_sha256)
    values(v_checkpoint_id,p_project_id,(v_item->>'id')::uuid,(v_item->>'pageNumber')::integer,(v_item->>'revision')::bigint,v_item->>'canvasSha256');
  end loop;
  return v_checkpoint_id;
end $$;

commit;
