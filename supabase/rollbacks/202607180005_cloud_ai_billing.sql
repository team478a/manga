begin;

drop function if exists public.get_my_cloud_ai_quota();
drop function if exists public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb);
drop function if exists public.consume_cloud_ai_rate_limit(text,text,integer,integer);
drop trigger if exists profiles_provision_cloud_ai_entitlement on public.profiles;
drop function if exists public.provision_cloud_ai_entitlement();

create or replace function public.cancel_cloud_generation_job(p_job_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
begin
  update public.cloud_generation_jobs set status='canceled',canceled_at=now(),finished_at=now(),lease_token=null,lease_expires_at=null,updated_at=now()
  where id=p_job_id and status in('queued','running') and public.cloud_project_can_edit(project_id);
  if not found then raise exception 'cloud_generation_job_not_cancelable'; end if;
  return p_job_id;
end;
$$;

create or replace function public.finish_cloud_generation_job(p_job_id uuid,p_lease_token uuid,p_succeeded boolean,p_output jsonb default null,p_output_asset_id uuid default null,p_provider_job_id text default null,p_actual_cost_micros bigint default null,p_error_code text default null,p_error_message text default null,p_retryable boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_generation_jobs%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id and status='running' and lease_token=p_lease_token for update;
  if not found then raise exception 'cloud_generation_lease_invalid'; end if;
  if p_output_asset_id is not null and not exists(select 1 from public.cloud_assets where id=p_output_asset_id and project_id=v_job.project_id) then raise exception 'cloud_generation_output_asset_invalid'; end if;
  if p_succeeded then
    update public.cloud_generation_jobs set status='completed',progress=100,output=coalesce(p_output,'{}'::jsonb),output_asset_id=p_output_asset_id,provider_job_id=p_provider_job_id,actual_cost_micros=p_actual_cost_micros,error_code=null,error_message=null,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=p_job_id;
  elsif p_retryable and v_job.attempt_count<v_job.max_attempts then
    update public.cloud_generation_jobs set status='queued',progress=0,provider_job_id=p_provider_job_id,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,retry_at=now()+make_interval(secs=>5*power(2,v_job.attempt_count-1)::integer),updated_at=now() where id=p_job_id;
  else
    update public.cloud_generation_jobs set status='failed',provider_job_id=p_provider_job_id,actual_cost_micros=p_actual_cost_micros,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=p_job_id;
  end if;
  return p_job_id;
end;
$$;

grant execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) to authenticated;

alter table public.cloud_generation_jobs
  drop column billing_settled_at,
  drop column pricing_version,
  drop column reservation_date,
  drop column billing_period_starts_at,
  drop column reserved_cost_micros,
  drop column reserved_credits;

drop table if exists public.cloud_ai_cost_ledger;
drop table if exists public.cloud_ai_rate_limits;
drop table if exists public.cloud_ai_settings;
drop table if exists public.cloud_ai_daily_costs;
drop table if exists public.cloud_ai_usage_periods;
drop table if exists public.cloud_ai_provider_prices;
drop table if exists public.cloud_ai_entitlements;
drop table if exists public.cloud_ai_plans;

commit;
