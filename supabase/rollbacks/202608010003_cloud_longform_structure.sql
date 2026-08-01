begin;

drop function if exists public.move_cloud_page_before(uuid,uuid);
drop function if exists public.add_cloud_page_to_scene(uuid);
drop function if exists public.add_cloud_scene(uuid,text,text);
drop function if exists public.add_cloud_episode_to_chapter(uuid,text);
drop function if exists public.add_cloud_chapter(uuid,text);

alter table public.cloud_pages drop column if exists scene_id;
alter table public.cloud_episodes drop column if exists chapter_id;
drop table if exists public.cloud_scenes;
drop table if exists public.cloud_chapters;

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
declare v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then raise exception 'profile_required'; end if;
  project_id := gen_random_uuid(); episode_id := gen_random_uuid(); page_id := gen_random_uuid();
  insert into public.cloud_projects(id,owner_profile_id,source_surface,content_class,title,description,age_rating,reading_direction,width,height,dpi)
  values(project_id,v_profile_id,'cloud','general',trim(p_title),coalesce(p_description,''),p_age_rating,p_reading_direction,p_width,p_height,p_dpi);
  insert into public.cloud_episodes(id,project_id,title,order_index) values(episode_id,project_id,'第1話',0);
  insert into public.cloud_pages(id,project_id,episode_id,page_number,order_index,width,height) values(page_id,project_id,episode_id,1,0,p_width,p_height);
  insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id) values(project_id,page_id,0,jsonb_build_object('schemaVersion',1,'pageId',page_id,'width',p_width,'height',p_height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile_id);
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id) values(project_id,0,jsonb_build_object('event','project_created','episodeId',episode_id,'pageId',page_id),v_profile_id);
  return next;
end $$;

commit;
