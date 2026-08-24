begin;
do $$begin if exists(select 1 from public.cloud_character_state_assignments)then raise exception 'cloud_character_state_assignments_rollback_requires_empty_table';end if;end$$;
drop function public.delete_cloud_character_state_assignment(uuid,uuid);drop function public.save_cloud_character_state_assignment(uuid,uuid,uuid,integer,integer,text,text,text,text,integer);drop table public.cloud_character_state_assignments;notify pgrst,'reload schema';
commit;
