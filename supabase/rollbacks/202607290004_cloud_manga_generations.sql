begin;
drop function if exists public.create_cloud_manga_generation(uuid,jsonb,timestamptz);
drop function if exists public.build_cloud_manga_panels(uuid,text,timestamptz);
drop table if exists public.cloud_manga_generations;
commit;
