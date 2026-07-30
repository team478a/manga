begin;
drop function if exists public.materialize_cloud_storyboard_project(uuid);
drop function if exists public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb);
drop table if exists public.cloud_story_storyboard_projects;
commit;
