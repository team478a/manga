begin;
drop function if exists public.link_cloud_generation_retry(uuid,uuid);
notify pgrst, 'reload schema';
commit;
