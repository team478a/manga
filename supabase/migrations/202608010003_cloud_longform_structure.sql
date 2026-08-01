begin;

create table if not exists public.cloud_chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  order_index integer not null check (order_index >= 0),
  revision bigint not null default 0 check (revision >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, order_index),
  unique (id, project_id)
);

alter table public.cloud_episodes
  add column if not exists chapter_id uuid references public.cloud_chapters(id) on delete set null;

create table if not exists public.cloud_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  chapter_id uuid not null references public.cloud_chapters(id) on delete cascade,
  episode_id uuid not null references public.cloud_episodes(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 2000),
  order_index integer not null check (order_index >= 0),
  revision bigint not null default 0 check (revision >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, order_index),
  unique (id, episode_id)
);

alter table public.cloud_pages
  add column if not exists scene_id uuid references public.cloud_scenes(id) on delete set null;

create index if not exists cloud_chapters_project_idx
  on public.cloud_chapters(project_id, order_index) where deleted_at is null;
create index if not exists cloud_episodes_chapter_idx
  on public.cloud_episodes(chapter_id, order_index) where deleted_at is null;
create index if not exists cloud_scenes_episode_idx
  on public.cloud_scenes(episode_id, order_index) where deleted_at is null;
create index if not exists cloud_pages_scene_idx
  on public.cloud_pages(scene_id, order_index) where deleted_at is null;

alter table public.cloud_chapters enable row level security;
alter table public.cloud_scenes enable row level security;
grant select on public.cloud_chapters, public.cloud_scenes to anon, authenticated;
grant insert, update, delete on public.cloud_chapters, public.cloud_scenes to authenticated;

drop policy if exists "cloud_chapters_read" on public.cloud_chapters;
create policy "cloud_chapters_read" on public.cloud_chapters for select
  using (public.cloud_project_can_read(project_id));
drop policy if exists "cloud_chapters_write" on public.cloud_chapters;
create policy "cloud_chapters_write" on public.cloud_chapters for all
  using (public.cloud_project_can_edit(project_id))
  with check (public.cloud_project_can_edit(project_id));
drop policy if exists "cloud_scenes_read" on public.cloud_scenes;
create policy "cloud_scenes_read" on public.cloud_scenes for select
  using (public.cloud_project_can_read(project_id));
drop policy if exists "cloud_scenes_write" on public.cloud_scenes;
create policy "cloud_scenes_write" on public.cloud_scenes for all
  using (public.cloud_project_can_edit(project_id))
  with check (public.cloud_project_can_edit(project_id));

do $$
declare
  v_project record;
  v_episode record;
  v_chapter_id uuid;
  v_scene_id uuid;
begin
  for v_project in
    select id from public.cloud_projects where deleted_at is null
  loop
    select id into v_chapter_id
    from public.cloud_chapters
    where project_id = v_project.id and deleted_at is null
    order by order_index limit 1;
    if v_chapter_id is null then
      insert into public.cloud_chapters(project_id, title, order_index)
      values (v_project.id, '第1章', 0) returning id into v_chapter_id;
    end if;
    for v_episode in
      select id from public.cloud_episodes
      where project_id = v_project.id and deleted_at is null
      order by order_index
    loop
      update public.cloud_episodes set chapter_id = v_chapter_id
      where id = v_episode.id and chapter_id is null;
      select id into v_scene_id
      from public.cloud_scenes
      where episode_id = v_episode.id and deleted_at is null
      order by order_index limit 1;
      if v_scene_id is null then
        insert into public.cloud_scenes(
          project_id, chapter_id, episode_id, title, order_index
        ) values (
          v_project.id, v_chapter_id, v_episode.id, 'シーン1', 0
        ) returning id into v_scene_id;
      end if;
      update public.cloud_pages set scene_id = v_scene_id
      where episode_id = v_episode.id and scene_id is null;
    end loop;
  end loop;
end $$;

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
language plpgsql security invoker set search_path = public as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_chapter_id uuid := gen_random_uuid();
  v_scene_id uuid := gen_random_uuid();
begin
  if v_profile_id is null then raise exception 'profile_required'; end if;
  project_id := gen_random_uuid(); episode_id := gen_random_uuid(); page_id := gen_random_uuid();
  insert into public.cloud_projects(id,owner_profile_id,source_surface,content_class,title,description,age_rating,reading_direction,width,height,dpi)
  values(project_id,v_profile_id,'cloud','general',trim(p_title),coalesce(p_description,''),p_age_rating,p_reading_direction,p_width,p_height,p_dpi);
  insert into public.cloud_chapters(id,project_id,title,order_index) values(v_chapter_id,project_id,'第1章',0);
  insert into public.cloud_episodes(id,project_id,chapter_id,title,order_index) values(episode_id,project_id,v_chapter_id,'第1話',0);
  insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,order_index) values(v_scene_id,project_id,v_chapter_id,episode_id,'シーン1',0);
  insert into public.cloud_pages(id,project_id,episode_id,scene_id,page_number,order_index,width,height)
  values(page_id,project_id,episode_id,v_scene_id,1,0,p_width,p_height);
  insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id)
  values(project_id,page_id,0,jsonb_build_object('schemaVersion',1,'pageId',page_id,'width',p_width,'height',p_height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile_id);
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id)
  values(project_id,0,jsonb_build_object('event','project_created','chapterId',v_chapter_id,'episodeId',episode_id,'sceneId',v_scene_id,'pageId',page_id),v_profile_id);
  return next;
end $$;

create or replace function public.add_cloud_chapter(p_project_id uuid, p_title text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid:=gen_random_uuid();v_order integer;v_revision bigint;v_profile uuid:=public.current_profile_id();
begin
  if not public.cloud_project_can_edit(p_project_id) or char_length(trim(coalesce(p_title,''))) not between 1 and 200 then raise exception 'cloud_chapter_not_editable';end if;
  perform 1 from public.cloud_projects where id=p_project_id for update;
  select coalesce(max(order_index),-1)+1 into v_order from public.cloud_chapters where project_id=p_project_id and deleted_at is null;
  insert into public.cloud_chapters(id,project_id,title,order_index) values(v_id,p_project_id,trim(p_title),v_order);
  update public.cloud_projects set revision=revision+1,updated_at=now() where id=p_project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(p_project_id,v_revision,jsonb_build_object('event','chapter_added','chapterId',v_id),v_profile);
  return v_id;
end $$;

create or replace function public.add_cloud_episode_to_chapter(p_chapter_id uuid,p_title text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_chapter public.cloud_chapters%rowtype;v_episode uuid:=gen_random_uuid();v_scene uuid:=gen_random_uuid();v_order integer;v_revision bigint;v_profile uuid:=public.current_profile_id();
begin
  select * into v_chapter from public.cloud_chapters where id=p_chapter_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_chapter.project_id) or char_length(trim(coalesce(p_title,''))) not between 1 and 200 then raise exception 'cloud_chapter_not_editable';end if;
  perform 1 from public.cloud_projects where id=v_chapter.project_id for update;
  select coalesce(max(order_index),-1)+1 into v_order from public.cloud_episodes where project_id=v_chapter.project_id and deleted_at is null;
  insert into public.cloud_episodes(id,project_id,chapter_id,title,order_index) values(v_episode,v_chapter.project_id,v_chapter.id,trim(p_title),v_order);
  insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,order_index) values(v_scene,v_chapter.project_id,v_chapter.id,v_episode,'シーン1',0);
  update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_chapter.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_chapter.project_id,v_revision,jsonb_build_object('event','episode_added','chapterId',v_chapter.id,'episodeId',v_episode,'sceneId',v_scene),v_profile);
  return v_episode;
end $$;

create or replace function public.add_cloud_scene(p_episode_id uuid,p_title text,p_summary text default '')
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_episode public.cloud_episodes%rowtype;v_id uuid:=gen_random_uuid();v_order integer;v_revision bigint;v_profile uuid:=public.current_profile_id();
begin
  select * into v_episode from public.cloud_episodes where id=p_episode_id and deleted_at is null;
  if not found or v_episode.chapter_id is null or not public.cloud_project_can_edit(v_episode.project_id) or char_length(trim(coalesce(p_title,''))) not between 1 and 200 or char_length(coalesce(p_summary,''))>2000 then raise exception 'cloud_scene_not_editable';end if;
  perform 1 from public.cloud_projects where id=v_episode.project_id for update;
  select coalesce(max(order_index),-1)+1 into v_order from public.cloud_scenes where episode_id=p_episode_id and deleted_at is null;
  insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,summary,order_index) values(v_id,v_episode.project_id,v_episode.chapter_id,p_episode_id,trim(p_title),trim(coalesce(p_summary,'')),v_order);
  update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_episode.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_episode.project_id,v_revision,jsonb_build_object('event','scene_added','episodeId',p_episode_id,'sceneId',v_id),v_profile);
  return v_id;
end $$;

create or replace function public.add_cloud_page_to_scene(p_scene_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_scene public.cloud_scenes%rowtype;v_project public.cloud_projects%rowtype;v_id uuid:=gen_random_uuid();v_order integer;v_number integer;v_revision bigint;v_profile uuid:=public.current_profile_id();
begin
  select * into v_scene from public.cloud_scenes where id=p_scene_id and deleted_at is null;
  if not found or not public.cloud_project_can_edit(v_scene.project_id) then raise exception 'cloud_scene_not_editable';end if;
  select * into v_project from public.cloud_projects where id=v_scene.project_id for update;
  select max(page.order_index)+1 into v_order
  from public.cloud_pages page
  where page.scene_id=v_scene.id and page.deleted_at is null;
  if v_order is null then
    select min(page.order_index) into v_order
    from public.cloud_pages page
    join public.cloud_scenes later_scene on later_scene.id=page.scene_id
    where page.episode_id=v_scene.episode_id and page.deleted_at is null
      and later_scene.deleted_at is null and later_scene.order_index>v_scene.order_index;
  end if;
  if v_order is null then
    select coalesce(max(order_index),-1)+1 into v_order
    from public.cloud_pages where episode_id=v_scene.episode_id and deleted_at is null;
  end if;
  update public.cloud_pages set order_index=order_index+1000000
  where episode_id=v_scene.episode_id and deleted_at is null and order_index>=v_order;
  update public.cloud_pages set order_index=order_index-999999
  where episode_id=v_scene.episode_id and deleted_at is null and order_index>=1000000;
  select coalesce(max(page_number),0)+1 into v_number from public.cloud_pages where project_id=v_scene.project_id and deleted_at is null;
  insert into public.cloud_pages(id,project_id,episode_id,scene_id,page_number,order_index,width,height) values(v_id,v_scene.project_id,v_scene.episode_id,v_scene.id,v_number,v_order,v_project.width,v_project.height);
  insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id) values(v_scene.project_id,v_id,0,jsonb_build_object('schemaVersion',1,'pageId',v_id,'width',v_project.width,'height',v_project.height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile);
  with numbered as(
    select page.id,row_number() over(order by chapter.order_index,episode.order_index,page.order_index,page.id)::integer as n
    from public.cloud_pages page
    join public.cloud_episodes episode on episode.id=page.episode_id
    left join public.cloud_chapters chapter on chapter.id=episode.chapter_id
    where page.project_id=v_scene.project_id and page.deleted_at is null and episode.deleted_at is null
  ) update public.cloud_pages page set page_number=numbered.n from numbered where page.id=numbered.id;
  update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_scene.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_scene.project_id,v_revision,jsonb_build_object('event','page_added','episodeId',v_scene.episode_id,'sceneId',v_scene.id,'pageId',v_id),v_profile);
  return v_id;
end $$;

create or replace function public.move_cloud_page_before(p_page_id uuid,p_target_page_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_page public.cloud_pages%rowtype;v_target public.cloud_pages%rowtype;v_revision bigint;v_profile uuid:=public.current_profile_id();
begin
  if p_page_id=p_target_page_id then return p_page_id;end if;
  select * into v_page from public.cloud_pages where id=p_page_id and deleted_at is null;
  select * into v_target from public.cloud_pages where id=p_target_page_id and deleted_at is null;
  if v_page.id is null or v_target.id is null or v_page.project_id<>v_target.project_id or v_page.episode_id<>v_target.episode_id or not public.cloud_project_can_edit(v_page.project_id) then raise exception 'cloud_page_move_invalid';end if;
  perform 1 from public.cloud_projects where id=v_page.project_id for update;
  update public.cloud_pages set order_index=2147483647 where id=v_page.id;
  if v_page.order_index<v_target.order_index then
    update public.cloud_pages set order_index=order_index+1000000 where episode_id=v_page.episode_id and deleted_at is null and order_index>v_page.order_index and order_index<v_target.order_index;
    update public.cloud_pages set order_index=order_index-1000001 where episode_id=v_page.episode_id and deleted_at is null and order_index>=1000000 and order_index<2147483647;
    update public.cloud_pages set order_index=v_target.order_index-1,scene_id=v_target.scene_id where id=v_page.id;
  else
    update public.cloud_pages set order_index=order_index+1000000 where episode_id=v_page.episode_id and deleted_at is null and order_index>=v_target.order_index and order_index<v_page.order_index;
    update public.cloud_pages set order_index=order_index-999999 where episode_id=v_page.episode_id and deleted_at is null and order_index>=1000000 and order_index<2147483647;
    update public.cloud_pages set order_index=v_target.order_index,scene_id=v_target.scene_id where id=v_page.id;
  end if;
  with numbered as(select page.id,row_number() over(order by chapter.order_index,episode.order_index,page.order_index,page.id)::integer as n from public.cloud_pages page join public.cloud_episodes episode on episode.id=page.episode_id left join public.cloud_chapters chapter on chapter.id=episode.chapter_id where page.project_id=v_page.project_id and page.deleted_at is null and episode.deleted_at is null) update public.cloud_pages page set page_number=numbered.n from numbered where page.id=numbered.id;
  update public.cloud_projects set revision=revision+1,updated_at=now() where id=v_page.project_id returning revision into v_revision;
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(v_page.project_id,v_revision,jsonb_build_object('event','page_reordered','pageId',v_page.id,'beforePageId',v_target.id,'sceneId',v_target.scene_id),v_profile);
  return v_page.id;
end $$;

revoke all on function public.add_cloud_chapter(uuid,text) from public,anon;
revoke all on function public.add_cloud_episode_to_chapter(uuid,text) from public,anon;
revoke all on function public.add_cloud_scene(uuid,text,text) from public,anon;
revoke all on function public.add_cloud_page_to_scene(uuid) from public,anon;
revoke all on function public.move_cloud_page_before(uuid,uuid) from public,anon;
grant execute on function public.add_cloud_chapter(uuid,text) to authenticated,service_role;
grant execute on function public.add_cloud_episode_to_chapter(uuid,text) to authenticated,service_role;
grant execute on function public.add_cloud_scene(uuid,text,text) to authenticated,service_role;
grant execute on function public.add_cloud_page_to_scene(uuid) to authenticated,service_role;
grant execute on function public.move_cloud_page_before(uuid,uuid) to authenticated,service_role;

commit;
