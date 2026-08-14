begin;
drop function if exists public.save_cloud_page_dialogue_placement(uuid,bigint,jsonb,text,integer,integer,text[]);
drop function if exists public.set_cloud_page_dialogue_placement_result(uuid,text,integer,integer,text[],boolean);
drop function if exists public.find_pending_cloud_page_dialogue_placement();
drop function if exists public.cloud_page_images_ready_for_dialogue(uuid);
drop table if exists public.cloud_page_dialogue_placements;
notify pgrst, 'reload schema';
commit;
