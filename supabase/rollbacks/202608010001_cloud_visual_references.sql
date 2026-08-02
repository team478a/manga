begin;
drop function if exists public.delete_cloud_panel_subject_assignment(uuid,uuid);
drop function if exists public.save_cloud_panel_subject_assignment(uuid,uuid,uuid,text,uuid);
drop function if exists public.delete_cloud_visual_reference(uuid,uuid);
drop function if exists public.save_cloud_visual_reference(uuid,text,uuid,uuid,text);
drop function if exists public.cloud_visual_subject_exists(uuid,text,uuid,uuid);
drop table if exists public.cloud_panel_subject_assignments;
drop table if exists public.cloud_visual_reference_assets;
commit;
