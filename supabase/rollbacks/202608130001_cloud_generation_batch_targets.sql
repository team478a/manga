begin;

drop function if exists public.dispatch_next_cloud_generation_batch_target();
drop function if exists public.retry_cloud_generation_batch_targets(uuid);
drop function if exists public.get_cloud_generation_batch_target_progress(uuid);
drop function if exists public.create_cloud_generation_batch_targets(uuid,uuid[],text,jsonb);

create or replace function public.set_cloud_generation_batch_state(p_batch_id uuid,p_status text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_batch public.cloud_generation_batches%rowtype;v_job record;
begin
  select * into v_batch from public.cloud_generation_batches where id=p_batch_id and created_by_profile_id=public.current_profile_id() for update;
  if v_batch.id is null or p_status not in('active','paused','canceled') then raise exception 'cloud_batch_not_editable';end if;
  if p_status='canceled' then
    for v_job in select job_id from public.cloud_generation_batch_jobs where batch_id=v_batch.id loop
      begin perform public.cancel_cloud_generation_job(v_job.job_id); exception when others then null; end;
    end loop;
  end if;
  update public.cloud_generation_batches set status=p_status,updated_at=now() where id=v_batch.id;
  return v_batch.id;
end $$;

drop table if exists public.cloud_generation_batch_targets;

commit;
