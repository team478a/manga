begin;
do $$begin
  if exists(select 1 from public.cloud_project_generation_readiness_policies) then
    raise exception 'cloud_generation_reference_readiness_rollback_requires_empty_table';
  end if;
end$$;
revoke all on function public.save_cloud_project_generation_readiness_policy(uuid,text) from authenticated,service_role;
drop function public.save_cloud_project_generation_readiness_policy(uuid,text);
drop table public.cloud_project_generation_readiness_policies;
notify pgrst, 'reload schema';
commit;
