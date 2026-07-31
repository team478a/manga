begin;
drop function if exists public.delete_cloud_character_profile(uuid,uuid);
drop function if exists public.save_cloud_character_profile(uuid,uuid,text,text,text,text,text,text,text,text[],text,text);
drop table if exists public.cloud_character_profile_versions;
drop table if exists public.cloud_character_profiles;
commit;
