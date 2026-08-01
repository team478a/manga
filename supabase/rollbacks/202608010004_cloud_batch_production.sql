begin;
drop function if exists public.replace_cloud_generation_batch_job(uuid,uuid);
drop function if exists public.release_cloud_page_edit_lock(uuid,uuid);
drop function if exists public.acquire_cloud_page_edit_lock(uuid,uuid,integer);
drop function if exists public.set_cloud_generation_batch_state(uuid,text);
drop function if exists public.attach_cloud_generation_batch_job(uuid,uuid);
drop function if exists public.create_cloud_generation_batch(uuid,uuid[],text);
drop table if exists public.cloud_page_edit_locks;
drop table if exists public.cloud_generation_batch_jobs;
drop table if exists public.cloud_generation_batches;
create or replace function public.claim_cloud_generation_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.cloud_generation_jobs language plpgsql security definer set search_path=public as $$
declare v_job_id uuid;v_token uuid:=gen_random_uuid();
begin
  if auth.role()<>'service_role' or char_length(trim(p_worker_id)) not between 1 and 100 or p_lease_seconds not between 30 and 900 then raise exception 'cloud_worker_not_authorized';end if;
  select id into v_job_id from public.cloud_generation_jobs where(status='queued' and(retry_at is null or retry_at<=now())) or(status='running' and lease_expires_at<=now()) order by created_at for update skip locked limit 1;
  if v_job_id is null then return;end if;
  return query update public.cloud_generation_jobs set status='running',progress=1,attempt_count=attempt_count+1,lease_token=v_token,lease_expires_at=now()+make_interval(secs=>p_lease_seconds),started_at=coalesce(started_at,now()),updated_at=now() where id=v_job_id returning *;
end $$;
commit;
