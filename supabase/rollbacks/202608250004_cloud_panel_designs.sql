begin;
do $$begin if exists(select 1 from public.cloud_panel_designs)or exists(select 1 from public.cloud_panel_design_versions)then raise exception'cloud_panel_designs_rollback_requires_empty_tables';end if;end$$;
drop function public.save_cloud_panel_design(uuid,uuid,uuid,bigint,jsonb);drop table public.cloud_panel_design_versions;drop table public.cloud_panel_designs;notify pgrst,'reload schema';
commit;
