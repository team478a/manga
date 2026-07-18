begin;

alter table public.cloud_projects add column cover_page_id uuid references public.cloud_pages(id) on delete set null;

create or replace function public.create_cloud_project_with_first_page(
  p_title text,
  p_description text default '',
  p_age_rating text default '全年齢',
  p_reading_direction text default 'rtl',
  p_width integer default 1600,
  p_height integer default 2400,
  p_dpi integer default 300
)
returns table(project_id uuid, episode_id uuid, page_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then raise exception 'profile_required'; end if;
  project_id := gen_random_uuid();
  episode_id := gen_random_uuid();
  page_id := gen_random_uuid();
  insert into public.cloud_projects(
    id, owner_profile_id, source_surface, content_class, title, description,
    age_rating, reading_direction, width, height, dpi
  ) values (
    project_id, v_profile_id, 'cloud', 'general', trim(p_title), coalesce(p_description, ''),
    p_age_rating, p_reading_direction, p_width, p_height, p_dpi
  );
  insert into public.cloud_episodes(id, project_id, title, order_index)
  values (episode_id, project_id, '第1話', 0);
  insert into public.cloud_pages(
    id, project_id, episode_id, page_number, order_index, width, height
  ) values (page_id, project_id, episode_id, 1, 0, p_width, p_height);
  insert into public.cloud_canvas_snapshots(
    project_id, page_id, revision, canvas, created_by_profile_id
  ) values (
    project_id, page_id, 0,
    jsonb_build_object(
      'schemaVersion', 1, 'pageId', page_id, 'width', p_width, 'height', p_height,
      'backgroundColor', '#ffffff', 'panels', jsonb_build_array(),
      'panelLayers', jsonb_build_array(), 'balloons', jsonb_build_array(), 'textObjects', jsonb_build_array()
    ), v_profile_id
  );
  insert into public.cloud_project_versions(
    project_id, revision, manifest, created_by_profile_id
  ) values (
    project_id, 0,
    jsonb_build_object('event', 'project_created', 'episodeId', episode_id, 'pageId', page_id),
    v_profile_id
  );
  return next;
end;
$$;

create or replace function public.add_cloud_episode(p_project_id uuid, p_title text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_episode_id uuid := gen_random_uuid();
  v_order integer;
  v_revision bigint;
begin
  if not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if;
  perform 1 from public.cloud_projects where id = p_project_id for update;
  select coalesce(max(order_index), -1) + 1 into v_order
  from public.cloud_episodes where project_id = p_project_id;
  insert into public.cloud_episodes(id, project_id, title, order_index)
  values (v_episode_id, p_project_id, trim(p_title), v_order);
  update public.cloud_projects set revision = revision + 1, updated_at = now()
  where id = p_project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id, revision, manifest, created_by_profile_id)
  values (p_project_id, v_revision, jsonb_build_object('event', 'episode_added', 'episodeId', v_episode_id), v_profile_id);
  return v_episode_id;
end;
$$;

create or replace function public.add_cloud_page(p_episode_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_episode public.cloud_episodes%rowtype;
  v_project public.cloud_projects%rowtype;
  v_page_id uuid := gen_random_uuid();
  v_order integer;
  v_page_number integer;
  v_revision bigint;
begin
  select * into v_episode from public.cloud_episodes
  where id = p_episode_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_episode.project_id) then
    raise exception 'cloud_episode_not_editable';
  end if;
  select * into v_project from public.cloud_projects where id = v_episode.project_id for update;
  select coalesce(max(order_index), -1) + 1 into v_order
  from public.cloud_pages where episode_id = p_episode_id;
  select coalesce(max(page_number), 0) + 1 into v_page_number
  from public.cloud_pages where project_id = v_episode.project_id;
  insert into public.cloud_pages(
    id, project_id, episode_id, page_number, order_index, width, height
  ) values (
    v_page_id, v_episode.project_id, p_episode_id, v_page_number, v_order,
    v_project.width, v_project.height
  );
  insert into public.cloud_canvas_snapshots(project_id, page_id, revision, canvas, created_by_profile_id)
  values (
    v_episode.project_id, v_page_id, 0,
    jsonb_build_object(
      'schemaVersion', 1, 'pageId', v_page_id, 'width', v_project.width, 'height', v_project.height,
      'backgroundColor', '#ffffff', 'panels', jsonb_build_array(),
      'panelLayers', jsonb_build_array(), 'balloons', jsonb_build_array(), 'textObjects', jsonb_build_array()
    ), v_profile_id
  );
  update public.cloud_projects set revision = revision + 1, updated_at = now()
  where id = v_episode.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id, revision, manifest, created_by_profile_id)
  values (v_episode.project_id, v_revision, jsonb_build_object('event', 'page_added', 'pageId', v_page_id, 'episodeId', p_episode_id), v_profile_id);
  return v_page_id;
end;
$$;

create or replace function public.rename_cloud_project(p_project_id uuid, p_title text, p_description text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_profile_id uuid := public.current_profile_id(); v_revision bigint;
begin
  if not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if;
  update public.cloud_projects set title=trim(p_title), description=coalesce(p_description,''), revision=revision+1, updated_at=now()
  where id=p_project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id)
  values(p_project_id,v_revision,jsonb_build_object('event','project_metadata_updated'),v_profile_id);
  return p_project_id;
end $$;

create or replace function public.rename_cloud_episode(p_episode_id uuid, p_title text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_episode public.cloud_episodes%rowtype; v_profile_id uuid := public.current_profile_id(); v_revision bigint;
begin
  select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if;
  update public.cloud_episodes set title=trim(p_title), revision=revision+1, updated_at=now() where id=p_episode_id;
  update public.cloud_projects set revision=revision+1, updated_at=now() where id=v_episode.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id)
  values(v_episode.project_id,v_revision,jsonb_build_object('event','episode_renamed','episodeId',p_episode_id),v_profile_id);
  return p_episode_id;
end $$;

create or replace function public.move_cloud_episode(p_episode_id uuid, p_direction integer)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_episode public.cloud_episodes%rowtype; v_other public.cloud_episodes%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint;
begin
  if p_direction not in (-1,1) then raise exception 'invalid_move_direction'; end if;
  select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if;
  perform 1 from public.cloud_projects where id=v_episode.project_id for update;
  if p_direction=-1 then select * into v_other from public.cloud_episodes where project_id=v_episode.project_id and deleted_at is null and order_index<v_episode.order_index order by order_index desc limit 1;
  else select * into v_other from public.cloud_episodes where project_id=v_episode.project_id and deleted_at is null and order_index>v_episode.order_index order by order_index limit 1; end if;
  if not found then return p_episode_id; end if;
  update public.cloud_episodes set order_index=2147483647 where id=v_episode.id;
  update public.cloud_episodes set order_index=v_episode.order_index where id=v_other.id;
  update public.cloud_episodes set order_index=v_other.order_index where id=v_episode.id;
  update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','episode_moved','episodeId',p_episode_id),v_profile_id);
  return p_episode_id;
end $$;

create or replace function public.move_cloud_page(p_page_id uuid, p_direction integer)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_page public.cloud_pages%rowtype; v_other public.cloud_pages%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint;
begin
  if p_direction not in (-1,1) then raise exception 'invalid_move_direction'; end if;
  select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'cloud_page_not_editable'; end if;
  perform 1 from public.cloud_projects where id=v_page.project_id for update;
  if p_direction=-1 then select * into v_other from public.cloud_pages where episode_id=v_page.episode_id and deleted_at is null and order_index<v_page.order_index order by order_index desc limit 1;
  else select * into v_other from public.cloud_pages where episode_id=v_page.episode_id and deleted_at is null and order_index>v_page.order_index order by order_index limit 1; end if;
  if not found then return p_page_id; end if;
  update public.cloud_pages set order_index=2147483647 where id=v_page.id;
  update public.cloud_pages set order_index=v_page.order_index where id=v_other.id;
  update public.cloud_pages set order_index=v_other.order_index where id=v_page.id;
  update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_revision,jsonb_build_object('event','page_moved','pageId',p_page_id),v_profile_id);
  return p_page_id;
end $$;

create or replace function public.soft_delete_cloud_episode(p_episode_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_episode public.cloud_episodes%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint;
begin
  select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_episode.project_id) then raise exception 'cloud_episode_not_editable'; end if;
  perform 1 from public.cloud_projects where id=v_episode.project_id for update;
  if (select count(*) from public.cloud_episodes where project_id=v_episode.project_id and deleted_at is null)<=1 then raise exception 'last_episode_cannot_be_deleted'; end if;
  update public.cloud_episodes set deleted_at=now(),updated_at=now() where id=p_episode_id;
  update public.cloud_pages set deleted_at=now(),updated_at=now() where episode_id=p_episode_id and deleted_at is null;
  update public.cloud_projects set cover_page_id=case when exists(select 1 from public.cloud_pages where id=cloud_projects.cover_page_id and episode_id=p_episode_id) then null else cover_page_id end,revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','episode_deleted','episodeId',p_episode_id),v_profile_id);
  return p_episode_id;
end $$;

create or replace function public.soft_delete_cloud_page(p_page_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_page public.cloud_pages%rowtype; v_profile_id uuid:=public.current_profile_id(); v_revision bigint;
begin
  select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'cloud_page_not_editable'; end if;
  perform 1 from public.cloud_projects where id=v_page.project_id for update;
  if (select count(*) from public.cloud_pages where project_id=v_page.project_id and deleted_at is null)<=1 then raise exception 'last_page_cannot_be_deleted'; end if;
  update public.cloud_pages set deleted_at=now(),updated_at=now() where id=p_page_id;
  update public.cloud_projects set cover_page_id=case when cover_page_id=p_page_id then null else cover_page_id end,revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_revision,jsonb_build_object('event','page_deleted','pageId',p_page_id),v_profile_id);
  return p_page_id;
end $$;

create or replace function public.set_cloud_project_cover(p_project_id uuid,p_page_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id(); v_revision bigint;
begin
  if not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if;
  if not exists(select 1 from public.cloud_pages where id=p_page_id and project_id=p_project_id and deleted_at is null) then raise exception 'cover_page_not_found'; end if;
  update public.cloud_projects set cover_page_id=p_page_id,revision=revision+1,updated_at=now() where id=p_project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(p_project_id,v_revision,jsonb_build_object('event','cover_page_changed','pageId',p_page_id),v_profile_id);
  return p_page_id;
end $$;

revoke execute on function public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer) from public, anon;
revoke execute on function public.add_cloud_episode(uuid,text) from public, anon;
revoke execute on function public.add_cloud_page(uuid) from public, anon;
revoke execute on function public.rename_cloud_project(uuid,text,text) from public, anon;
revoke execute on function public.rename_cloud_episode(uuid,text) from public, anon;
revoke execute on function public.move_cloud_episode(uuid,integer) from public,anon;
revoke execute on function public.move_cloud_page(uuid,integer) from public,anon;
revoke execute on function public.soft_delete_cloud_episode(uuid) from public,anon;
revoke execute on function public.soft_delete_cloud_page(uuid) from public,anon;
revoke execute on function public.set_cloud_project_cover(uuid,uuid) from public,anon;
grant execute on function public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer) to authenticated, service_role;
grant execute on function public.add_cloud_episode(uuid,text) to authenticated, service_role;
grant execute on function public.add_cloud_page(uuid) to authenticated, service_role;
grant execute on function public.rename_cloud_project(uuid,text,text) to authenticated, service_role;
grant execute on function public.rename_cloud_episode(uuid,text) to authenticated, service_role;
grant execute on function public.move_cloud_episode(uuid,integer) to authenticated,service_role;
grant execute on function public.move_cloud_page(uuid,integer) to authenticated,service_role;
grant execute on function public.soft_delete_cloud_episode(uuid) to authenticated,service_role;
grant execute on function public.soft_delete_cloud_page(uuid) to authenticated,service_role;
grant execute on function public.set_cloud_project_cover(uuid,uuid) to authenticated,service_role;

commit;
