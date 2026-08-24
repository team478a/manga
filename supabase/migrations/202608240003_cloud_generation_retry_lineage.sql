begin;
create or replace function public.link_cloud_generation_retry(p_source_job_id uuid,p_retry_job_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id();v_source public.cloud_generation_jobs%rowtype;v_retry public.cloud_generation_jobs%rowtype;v_root uuid;
begin
  if v_profile is null or p_source_job_id=p_retry_job_id then raise exception 'cloud_generation_retry_lineage_invalid';end if;
  select * into v_source from public.cloud_generation_jobs where id=p_source_job_id and created_by_profile_id=v_profile for update;
  if not found then raise exception 'cloud_generation_retry_lineage_invalid';end if;
  select * into v_retry from public.cloud_generation_jobs where id=p_retry_job_id and created_by_profile_id=v_profile for update;
  if not found or v_source.status<>'failed' or v_retry.status<>'queued' or v_source.project_id<>v_retry.project_id or v_source.page_id is distinct from v_retry.page_id or v_retry.parent_job_id is not null or v_retry.root_job_id is not null or not public.cloud_project_can_edit(v_source.project_id) then raise exception 'cloud_generation_retry_lineage_invalid';end if;
  v_root:=coalesce(v_source.root_job_id,v_source.id);
  if v_root=p_retry_job_id then raise exception 'cloud_generation_retry_lineage_cycle';end if;
  update public.cloud_generation_jobs set retry_disposition='manual',updated_at=now() where id=v_source.id;
  update public.cloud_generation_jobs set parent_job_id=v_source.id,root_job_id=v_root,execution_phase='queued',last_checkpoint_at=now(),updated_at=now() where id=v_retry.id;
  insert into public.cloud_generation_job_events(job_id,project_id,owner_profile_id,execution_phase,event_type,attempt_number,metadata) values(v_source.id,v_source.project_id,v_profile,'failed','retry_scheduled',greatest(v_source.attempt_count,0),jsonb_build_object('retryJobId',v_retry.id));
  return v_retry.id;
end$$;
revoke all on function public.link_cloud_generation_retry(uuid,uuid) from public,anon;
grant execute on function public.link_cloud_generation_retry(uuid,uuid) to authenticated,service_role;
notify pgrst, 'reload schema';
commit;
