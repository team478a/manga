begin;
drop function if exists public.find_pending_cloud_generation_panel_adoption();
drop function if exists public.save_cloud_generation_panel_adoption(uuid,bigint,jsonb);
drop function if exists public.set_cloud_generation_panel_adoption_result(uuid,text,text,boolean,bigint);
drop table if exists public.cloud_generation_panel_adoptions;
notify pgrst, 'reload schema';
commit;
