begin;
drop function if exists public.delete_cloud_world_profile(uuid, uuid);
drop function if exists public.save_cloud_world_profile(uuid, uuid, text, text, text, text[], text, text[], text, text);
drop function if exists public.save_cloud_style_bible(uuid, text, text, text, text, text, text);
drop table if exists public.cloud_world_profile_versions;
drop table if exists public.cloud_world_profiles;
drop table if exists public.cloud_style_bible_versions;
drop table if exists public.cloud_style_bibles;
commit;
