begin;
drop function if exists public.save_cloud_chapter_production_plan(uuid,uuid,text,text,date,text);
drop table if exists public.cloud_chapter_production_plans;
commit;
