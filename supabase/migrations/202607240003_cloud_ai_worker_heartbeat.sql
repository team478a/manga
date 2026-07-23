begin;

create or replace function public.extend_cloud_generation_job_lease(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 300
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires_at timestamptz;
begin
  if auth.role() <> 'service_role'
     or p_lease_seconds not between 150 and 900 then
    raise exception 'cloud_worker_not_authorized';
  end if;

  update public.cloud_generation_jobs
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and lease_token = p_lease_token
    and lease_expires_at > now()
  returning lease_expires_at into v_expires_at;

  if v_expires_at is null then
    raise exception 'cloud_generation_lease_invalid';
  end if;
  return v_expires_at;
end;
$$;

revoke execute on function public.extend_cloud_generation_job_lease(
  uuid,uuid,integer
) from public,anon,authenticated;
grant execute on function public.extend_cloud_generation_job_lease(
  uuid,uuid,integer
) to service_role;

commit;
