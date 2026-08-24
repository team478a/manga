begin;
do $$ begin
  if exists(select 1 from public.cloud_generation_run_checkpoints limit 1) then
    raise exception 'cloud_generation_run_checkpoints_rollback_blocked';
  end if;
end $$;
drop function if exists public.record_cloud_generation_run_checkpoint(uuid);
drop table if exists public.cloud_generation_run_checkpoints;
notify pgrst, 'reload schema';
commit;
