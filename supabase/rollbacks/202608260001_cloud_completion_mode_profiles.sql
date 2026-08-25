begin;

drop function if exists public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer,jsonb);
alter table public.cloud_projects drop column if exists completion_mode_profile;

create function public.create_cloud_project_with_first_page(
  p_title text,p_description text default '',p_age_rating text default '全年齢',
  p_reading_direction text default 'rtl',p_width integer default 1600,
  p_height integer default 2400,p_dpi integer default 300
)
returns table(project_id uuid,episode_id uuid,page_id uuid)
language plpgsql security invoker set search_path=public as $$
declare v_profile_id uuid:=public.current_profile_id();v_chapter_id uuid:=gen_random_uuid();v_scene_id uuid:=gen_random_uuid();
begin
  if v_profile_id is null then raise exception 'profile_required';end if;
  project_id:=gen_random_uuid();episode_id:=gen_random_uuid();page_id:=gen_random_uuid();
  insert into public.cloud_projects(id,owner_profile_id,source_surface,content_class,title,description,age_rating,reading_direction,width,height,dpi) values(project_id,v_profile_id,'cloud','general',trim(p_title),coalesce(p_description,''),p_age_rating,p_reading_direction,p_width,p_height,p_dpi);
  insert into public.cloud_chapters(id,project_id,title,order_index)values(v_chapter_id,project_id,'第1章',0);
  insert into public.cloud_episodes(id,project_id,chapter_id,title,order_index)values(episode_id,project_id,v_chapter_id,'第1話',0);
  insert into public.cloud_scenes(id,project_id,chapter_id,episode_id,title,order_index)values(v_scene_id,project_id,v_chapter_id,episode_id,'シーン1',0);
  insert into public.cloud_pages(id,project_id,episode_id,scene_id,page_number,order_index,width,height)values(page_id,project_id,episode_id,v_scene_id,1,0,p_width,p_height);
  insert into public.cloud_canvas_snapshots(project_id,page_id,revision,canvas,created_by_profile_id)values(project_id,page_id,0,jsonb_build_object('schemaVersion',1,'pageId',page_id,'width',p_width,'height',p_height,'backgroundColor','#ffffff','panels',jsonb_build_array(),'panelLayers',jsonb_build_array(),'balloons',jsonb_build_array(),'textObjects',jsonb_build_array()),v_profile_id);
  insert into public.cloud_project_versions(project_id,revision,manifest,created_by_profile_id)values(project_id,0,jsonb_build_object('event','project_created','chapterId',v_chapter_id,'episodeId',episode_id,'sceneId',v_scene_id,'pageId',page_id),v_profile_id);
  return next;
end$$;
revoke all on function public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer)from public,anon;
grant execute on function public.create_cloud_project_with_first_page(text,text,text,text,integer,integer,integer)to authenticated,service_role;

commit;
