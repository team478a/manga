begin;
drop function if exists public.save_cloud_generation_panel_adoption_v2(uuid,bigint,jsonb);
drop function if exists public.is_cloud_generation_panel_adoption_revision_chain(uuid,bigint,bigint);
drop index if exists public.cloud_generation_panel_adoptions_revision_chain_idx;
notify pgrst, 'reload schema';
commit;
