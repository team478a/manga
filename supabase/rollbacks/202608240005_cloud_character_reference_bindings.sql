begin;
do $$begin if exists(select 1 from public.cloud_character_reference_bindings limit 1) then raise exception 'cloud_character_reference_bindings_rollback_blocked';end if;end$$;
drop function if exists public.delete_cloud_character_reference_binding(uuid,uuid);
drop function if exists public.save_cloud_character_reference_binding(uuid,uuid,uuid,uuid,text,text,integer,text);
drop table if exists public.cloud_character_reference_bindings;
notify pgrst, 'reload schema';
commit;
