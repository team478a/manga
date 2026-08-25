begin;
do $$begin if exists(select 1 from public.cloud_panel_continuity_states)then raise exception 'cloud_panel_continuity_states_rollback_requires_empty_table';end if;end$$;drop function public.delete_cloud_panel_continuity_state(uuid,uuid);drop function public.save_cloud_panel_continuity_state(uuid,uuid,uuid,text,uuid,text,text,text,text,text,text,uuid);drop table public.cloud_panel_continuity_states;notify pgrst,'reload schema';
commit;
