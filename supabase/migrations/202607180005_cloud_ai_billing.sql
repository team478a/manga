begin;

create table public.cloud_ai_plans (
  plan_key text primary key check (plan_key in ('free','trial','creator')),
  display_name text not null check (char_length(display_name) between 1 and 100),
  monthly_credits integer not null check (monthly_credits >= 0),
  monthly_cost_limit_micros bigint not null check (monthly_cost_limit_micros >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  user_requests_per_minute integer not null check (user_requests_per_minute between 1 and 1000),
  project_requests_per_minute integer not null check (project_requests_per_minute between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.cloud_ai_plans(plan_key,display_name,monthly_credits,monthly_cost_limit_micros,user_requests_per_minute,project_requests_per_minute) values
  ('free','Free',20,2000000,5,3),
  ('trial','Trial',100,10000000,10,6),
  ('creator','Creator',1000,100000000,30,20);

create table public.cloud_ai_entitlements (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  plan_key text not null references public.cloud_ai_plans(plan_key),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','expired')),
  source text not null default 'default' check (source in ('default','admin','stripe')),
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_ends_at > period_starts_at)
);

create table public.cloud_ai_provider_prices (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null check (char_length(provider_id) between 1 and 100),
  model_id text not null check (char_length(model_id) between 1 and 200),
  kind text not null check (kind in ('image','text')),
  job_type text not null check (job_type in ('background','prop','effect','character_base','story','storyboard','speech_bubble')),
  pricing_version text not null check (char_length(pricing_version) between 1 and 100),
  credits integer not null check (credits between 1 and 1000),
  max_cost_micros bigint not null check (max_cost_micros >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id,model_id,job_type,pricing_version)
);
create unique index cloud_ai_provider_prices_active_idx
  on public.cloud_ai_provider_prices(provider_id,model_id,job_type) where active;

create table public.cloud_ai_usage_periods (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  plan_key text not null references public.cloud_ai_plans(plan_key),
  credits_reserved integer not null default 0 check (credits_reserved >= 0),
  credits_used integer not null default 0 check (credits_used >= 0),
  cost_reserved_micros bigint not null default 0 check (cost_reserved_micros >= 0),
  cost_actual_micros bigint not null default 0 check (cost_actual_micros >= 0),
  updated_at timestamptz not null default now(),
  primary key(profile_id,period_starts_at),
  check(period_ends_at > period_starts_at)
);

create table public.cloud_ai_daily_costs (
  usage_date date primary key,
  cost_reserved_micros bigint not null default 0 check (cost_reserved_micros >= 0),
  cost_actual_micros bigint not null default 0 check (cost_actual_micros >= 0),
  updated_at timestamptz not null default now()
);

create table public.cloud_ai_settings (
  singleton boolean primary key default true check(singleton),
  generation_enabled boolean not null default false,
  daily_cost_limit_micros bigint not null default 100000000 check(daily_cost_limit_micros >= 0),
  warning_percent integer not null default 80 check(warning_percent between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.cloud_ai_settings(singleton) values(true);

create table public.cloud_ai_rate_limits (
  scope text not null check(scope in ('user','project','ip','global')),
  subject_key text not null check(char_length(subject_key) between 16 and 128),
  request_count integer not null default 0 check(request_count >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(scope,subject_key)
);

create table public.cloud_ai_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  project_id uuid not null references public.cloud_projects(id) on delete restrict,
  job_id uuid not null references public.cloud_generation_jobs(id) on delete restrict,
  event_type text not null check(event_type in ('reserve','settle','release')),
  credits_reserved_delta integer not null default 0,
  credits_used_delta integer not null default 0,
  cost_reserved_delta_micros bigint not null default 0,
  cost_actual_delta_micros bigint not null default 0,
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  pricing_version text not null check(char_length(pricing_version) between 1 and 100),
  created_at timestamptz not null default now(),
  unique(job_id,event_type),
  check(credits_reserved_delta <> 0 or credits_used_delta <> 0 or cost_reserved_delta_micros <> 0 or cost_actual_delta_micros <> 0)
);

alter table public.cloud_generation_jobs
  add column reserved_credits integer check(reserved_credits is null or reserved_credits > 0),
  add column reserved_cost_micros bigint check(reserved_cost_micros is null or reserved_cost_micros >= 0),
  add column billing_period_starts_at timestamptz,
  add column reservation_date date,
  add column pricing_version text check(pricing_version is null or char_length(pricing_version) between 1 and 100),
  add column billing_settled_at timestamptz;

alter table public.cloud_ai_plans enable row level security;
alter table public.cloud_ai_entitlements enable row level security;
alter table public.cloud_ai_provider_prices enable row level security;
alter table public.cloud_ai_usage_periods enable row level security;
alter table public.cloud_ai_daily_costs enable row level security;
alter table public.cloud_ai_settings enable row level security;
alter table public.cloud_ai_rate_limits enable row level security;
alter table public.cloud_ai_cost_ledger enable row level security;

grant select on public.cloud_ai_plans, public.cloud_ai_provider_prices to authenticated;
grant select on public.cloud_ai_entitlements, public.cloud_ai_usage_periods, public.cloud_ai_cost_ledger to authenticated;
grant select,insert,update on public.cloud_ai_plans, public.cloud_ai_entitlements, public.cloud_ai_provider_prices, public.cloud_ai_usage_periods, public.cloud_ai_daily_costs, public.cloud_ai_settings, public.cloud_ai_rate_limits, public.cloud_ai_cost_ledger to service_role;

create policy "cloud_ai_plans_read" on public.cloud_ai_plans for select using(active);
create policy "cloud_ai_prices_read" on public.cloud_ai_provider_prices for select using(active);
create policy "cloud_ai_entitlements_read" on public.cloud_ai_entitlements for select using(profile_id=public.current_profile_id());
create policy "cloud_ai_usage_read" on public.cloud_ai_usage_periods for select using(profile_id=public.current_profile_id());
create policy "cloud_ai_ledger_read" on public.cloud_ai_cost_ledger for select using(profile_id=public.current_profile_id());

create or replace function public.provision_cloud_ai_entitlement()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.cloud_ai_entitlements(profile_id,plan_key,status,source,period_starts_at,period_ends_at)
  values(new.id,'free','active','default',date_trunc('month',now()),date_trunc('month',now())+interval '1 month')
  on conflict(profile_id) do nothing;
  return new;
end;
$$;
create trigger profiles_provision_cloud_ai_entitlement after insert on public.profiles
for each row execute function public.provision_cloud_ai_entitlement();
insert into public.cloud_ai_entitlements(profile_id,plan_key,status,source,period_starts_at,period_ends_at)
select id,'free','active','default',date_trunc('month',now()),date_trunc('month',now())+interval '1 month' from public.profiles
on conflict(profile_id) do nothing;

create or replace function public.consume_cloud_ai_rate_limit(p_scope text,p_subject_key text,p_request_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_row public.cloud_ai_rate_limits%rowtype;
begin
  if p_scope not in('user','project','ip','global') or char_length(p_subject_key) not between 16 and 128
     or p_request_limit not between 1 and 1000 or p_window_seconds not between 1 and 86400 then
    raise exception 'cloud_ai_rate_limit_input_invalid';
  end if;
  insert into public.cloud_ai_rate_limits(scope,subject_key) values(p_scope,p_subject_key)
  on conflict(scope,subject_key) do nothing;
  select * into v_row from public.cloud_ai_rate_limits where scope=p_scope and subject_key=p_subject_key for update;
  if v_row.window_started_at <= now()-make_interval(secs=>p_window_seconds) then
    update public.cloud_ai_rate_limits set request_count=1,window_started_at=now(),updated_at=now()
    where scope=p_scope and subject_key=p_subject_key;
    return true;
  end if;
  if v_row.request_count >= p_request_limit then return false; end if;
  update public.cloud_ai_rate_limits set request_count=request_count+1,updated_at=now()
  where scope=p_scope and subject_key=p_subject_key;
  return true;
end;
$$;

create or replace function public.enqueue_cloud_generation_job_with_quota(
  p_project_id uuid,p_page_id uuid,p_kind text,p_job_type text,p_provider_id text,p_model_id text,
  p_idempotency_key text,p_prompt_sha256 text,p_input jsonb,p_moderation jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile_id uuid:=public.current_profile_id(); v_job_id uuid; v_ent public.cloud_ai_entitlements%rowtype;
  v_plan public.cloud_ai_plans%rowtype; v_price public.cloud_ai_provider_prices%rowtype;
  v_usage public.cloud_ai_usage_periods%rowtype; v_daily public.cloud_ai_daily_costs%rowtype;
  v_settings public.cloud_ai_settings%rowtype; v_today date:=current_date;
begin
  if v_profile_id is null or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_project_not_editable'; end if;
  select id into v_job_id from public.cloud_generation_jobs where created_by_profile_id=v_profile_id and idempotency_key=p_idempotency_key;
  if v_job_id is not null then return v_job_id; end if;
  if not exists(select 1 from public.cloud_projects where id=p_project_id and content_class='general' and deleted_at is null) then raise exception 'general_cloud_project_required'; end if;
  if p_page_id is not null and not exists(select 1 from public.cloud_pages where id=p_page_id and project_id=p_project_id and deleted_at is null) then raise exception 'cloud_page_not_found'; end if;
  if p_kind not in('image','text') or p_job_type not in('background','prop','effect','character_base','story','storyboard','speech_bubble')
     or (p_kind='image' and p_job_type not in('background','prop','effect','character_base'))
     or (p_kind='text' and p_job_type not in('story','storyboard','speech_bubble'))
     or p_input->>'kind' is distinct from p_kind or p_input->>'jobType' is distinct from p_job_type
     or nullif(trim(p_input->>'prompt'),'') is null or p_moderation->>'decision' is distinct from 'allow'
     or p_moderation->>'policyVersion' is distinct from '1' then raise exception 'cloud_generation_input_rejected'; end if;
  select * into v_settings from public.cloud_ai_settings where singleton for update;
  if not v_settings.generation_enabled then raise exception 'cloud_generation_disabled'; end if;
  select * into v_price from public.cloud_ai_provider_prices where provider_id=trim(p_provider_id) and model_id=trim(p_model_id) and job_type=p_job_type and kind=p_kind and active;
  if not found then raise exception 'cloud_generation_price_unavailable'; end if;
  select * into v_ent from public.cloud_ai_entitlements where profile_id=v_profile_id for update;
  if v_ent.source='default' and v_ent.period_ends_at<=now() then
    update public.cloud_ai_entitlements set period_starts_at=date_trunc('month',now()),period_ends_at=date_trunc('month',now())+interval '1 month',status='active',updated_at=now()
    where profile_id=v_profile_id returning * into v_ent;
  end if;
  if v_ent.status not in('active','trialing') or now()<v_ent.period_starts_at or now()>=v_ent.period_ends_at then raise exception 'cloud_entitlement_inactive'; end if;
  select * into v_plan from public.cloud_ai_plans where plan_key=v_ent.plan_key and active;
  if not found or v_plan.currency<>v_price.currency then raise exception 'cloud_plan_unavailable'; end if;
  if not public.consume_cloud_ai_rate_limit('user',v_profile_id::text,v_plan.user_requests_per_minute,60)
     or not public.consume_cloud_ai_rate_limit('project',p_project_id::text,v_plan.project_requests_per_minute,60) then raise exception 'cloud_generation_rate_limited'; end if;
  insert into public.cloud_ai_usage_periods(profile_id,period_starts_at,period_ends_at,plan_key)
  values(v_profile_id,v_ent.period_starts_at,v_ent.period_ends_at,v_ent.plan_key) on conflict(profile_id,period_starts_at) do nothing;
  select * into v_usage from public.cloud_ai_usage_periods where profile_id=v_profile_id and period_starts_at=v_ent.period_starts_at for update;
  if v_usage.credits_reserved+v_usage.credits_used+v_price.credits>v_plan.monthly_credits then raise exception 'cloud_credit_quota_exceeded'; end if;
  if v_usage.cost_reserved_micros+v_usage.cost_actual_micros+v_price.max_cost_micros>v_plan.monthly_cost_limit_micros then raise exception 'cloud_cost_quota_exceeded'; end if;
  insert into public.cloud_ai_daily_costs(usage_date) values(v_today) on conflict(usage_date) do nothing;
  select * into v_daily from public.cloud_ai_daily_costs where usage_date=v_today for update;
  if v_daily.cost_reserved_micros+v_daily.cost_actual_micros+v_price.max_cost_micros>v_settings.daily_cost_limit_micros then raise exception 'cloud_daily_budget_exceeded'; end if;
  insert into public.cloud_generation_jobs(project_id,page_id,created_by_profile_id,kind,job_type,provider_id,model_id,idempotency_key,prompt_sha256,input,moderation,estimated_cost_micros,reserved_credits,reserved_cost_micros,billing_period_starts_at,reservation_date,pricing_version)
  values(p_project_id,p_page_id,v_profile_id,p_kind,p_job_type,trim(p_provider_id),trim(p_model_id),trim(p_idempotency_key),p_prompt_sha256,p_input,p_moderation,v_price.max_cost_micros,v_price.credits,v_price.max_cost_micros,v_ent.period_starts_at,v_today,v_price.pricing_version)
  returning id into v_job_id;
  update public.cloud_ai_usage_periods set credits_reserved=credits_reserved+v_price.credits,cost_reserved_micros=cost_reserved_micros+v_price.max_cost_micros,updated_at=now()
  where profile_id=v_profile_id and period_starts_at=v_ent.period_starts_at;
  update public.cloud_ai_daily_costs set cost_reserved_micros=cost_reserved_micros+v_price.max_cost_micros,updated_at=now() where usage_date=v_today;
  insert into public.cloud_ai_cost_ledger(profile_id,project_id,job_id,event_type,credits_reserved_delta,cost_reserved_delta_micros,currency,pricing_version)
  values(v_profile_id,p_project_id,v_job_id,'reserve',v_price.credits,v_price.max_cost_micros,v_price.currency,v_price.pricing_version);
  return v_job_id;
end;
$$;

create or replace function public.cancel_cloud_generation_job(p_job_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_generation_jobs%rowtype; v_currency text;
begin
  select * into v_job from public.cloud_generation_jobs where id=p_job_id and status in('queued','running') and public.cloud_project_can_edit(project_id) for update;
  if not found then raise exception 'cloud_generation_job_not_cancelable'; end if;
  if v_job.reserved_credits is not null and v_job.billing_settled_at is null then
    select currency into v_currency from public.cloud_ai_plans p join public.cloud_ai_usage_periods u on u.plan_key=p.plan_key where u.profile_id=v_job.created_by_profile_id and u.period_starts_at=v_job.billing_period_starts_at;
    update public.cloud_ai_usage_periods set credits_reserved=greatest(0,credits_reserved-v_job.reserved_credits),cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),updated_at=now() where profile_id=v_job.created_by_profile_id and period_starts_at=v_job.billing_period_starts_at;
    update public.cloud_ai_daily_costs set cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),updated_at=now() where usage_date=v_job.reservation_date;
    insert into public.cloud_ai_cost_ledger(profile_id,project_id,job_id,event_type,credits_reserved_delta,cost_reserved_delta_micros,currency,pricing_version)
    values(v_job.created_by_profile_id,v_job.project_id,v_job.id,'release',-v_job.reserved_credits,-v_job.reserved_cost_micros,v_currency,v_job.pricing_version);
  end if;
  update public.cloud_generation_jobs set status='canceled',canceled_at=now(),finished_at=now(),billing_settled_at=case when reserved_credits is null then billing_settled_at else now() end,lease_token=null,lease_expires_at=null,updated_at=now() where id=p_job_id;
  return p_job_id;
end;
$$;

create or replace function public.finish_cloud_generation_job(p_job_id uuid,p_lease_token uuid,p_succeeded boolean,p_output jsonb default null,p_output_asset_id uuid default null,p_provider_job_id text default null,p_actual_cost_micros bigint default null,p_error_code text default null,p_error_message text default null,p_retryable boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_job public.cloud_generation_jobs%rowtype; v_currency text; v_actual bigint:=coalesce(p_actual_cost_micros,0); v_final boolean;
begin
  if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized'; end if;
  if v_actual<0 then raise exception 'cloud_generation_cost_invalid'; end if;
  select * into v_job from public.cloud_generation_jobs where id=p_job_id and status='running' and lease_token=p_lease_token for update;
  if not found then raise exception 'cloud_generation_lease_invalid'; end if;
  if p_output_asset_id is not null and not exists(select 1 from public.cloud_assets where id=p_output_asset_id and project_id=v_job.project_id) then raise exception 'cloud_generation_output_asset_invalid'; end if;
  v_final:=p_succeeded or not(p_retryable and v_job.attempt_count<v_job.max_attempts);
  if v_final and v_job.reserved_credits is not null and v_job.billing_settled_at is null then
    select currency into v_currency from public.cloud_ai_plans p join public.cloud_ai_usage_periods u on u.plan_key=p.plan_key where u.profile_id=v_job.created_by_profile_id and u.period_starts_at=v_job.billing_period_starts_at;
    update public.cloud_ai_usage_periods set credits_reserved=greatest(0,credits_reserved-v_job.reserved_credits),credits_used=credits_used+case when p_succeeded then v_job.reserved_credits else 0 end,cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),cost_actual_micros=cost_actual_micros+v_actual,updated_at=now() where profile_id=v_job.created_by_profile_id and period_starts_at=v_job.billing_period_starts_at;
    update public.cloud_ai_daily_costs set cost_reserved_micros=greatest(0,cost_reserved_micros-v_job.reserved_cost_micros),cost_actual_micros=cost_actual_micros+v_actual,updated_at=now() where usage_date=v_job.reservation_date;
    insert into public.cloud_ai_cost_ledger(profile_id,project_id,job_id,event_type,credits_reserved_delta,credits_used_delta,cost_reserved_delta_micros,cost_actual_delta_micros,currency,pricing_version)
    values(v_job.created_by_profile_id,v_job.project_id,v_job.id,case when p_succeeded then 'settle' else 'release' end,-v_job.reserved_credits,case when p_succeeded then v_job.reserved_credits else 0 end,-v_job.reserved_cost_micros,v_actual,v_currency,v_job.pricing_version);
    update public.cloud_ai_settings set generation_enabled=false,updated_at=now() where singleton and exists(select 1 from public.cloud_ai_daily_costs where usage_date=v_job.reservation_date and cost_actual_micros>=daily_cost_limit_micros);
  end if;
  if p_succeeded then
    update public.cloud_generation_jobs set status='completed',progress=100,output=coalesce(p_output,'{}'::jsonb),output_asset_id=p_output_asset_id,provider_job_id=p_provider_job_id,actual_cost_micros=v_actual,error_code=null,error_message=null,lease_token=null,lease_expires_at=null,finished_at=now(),billing_settled_at=case when reserved_credits is null then billing_settled_at else now() end,updated_at=now() where id=p_job_id;
  elsif p_retryable and v_job.attempt_count<v_job.max_attempts then
    update public.cloud_generation_jobs set status='queued',progress=0,provider_job_id=p_provider_job_id,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,retry_at=now()+make_interval(secs=>5*power(2,v_job.attempt_count-1)::integer),updated_at=now() where id=p_job_id;
  else
    update public.cloud_generation_jobs set status='failed',provider_job_id=p_provider_job_id,actual_cost_micros=v_actual,error_code=left(p_error_code,100),error_message=left(p_error_message,500),lease_token=null,lease_expires_at=null,finished_at=now(),billing_settled_at=case when reserved_credits is null then billing_settled_at else now() end,updated_at=now() where id=p_job_id;
  end if;
  return p_job_id;
end;
$$;

create or replace function public.get_my_cloud_ai_quota()
returns table(plan_key text,entitlement_status text,period_starts_at timestamptz,period_ends_at timestamptz,credits_limit integer,credits_reserved integer,credits_used integer,cost_limit_micros bigint,cost_reserved_micros bigint,cost_actual_micros bigint,currency text,generation_enabled boolean)
language sql security definer set search_path=public as $$
  select e.plan_key,e.status,e.period_starts_at,e.period_ends_at,p.monthly_credits,coalesce(u.credits_reserved,0),coalesce(u.credits_used,0),p.monthly_cost_limit_micros,coalesce(u.cost_reserved_micros,0),coalesce(u.cost_actual_micros,0),p.currency,s.generation_enabled
  from public.cloud_ai_entitlements e join public.cloud_ai_plans p on p.plan_key=e.plan_key
  cross join public.cloud_ai_settings s left join public.cloud_ai_usage_periods u on u.profile_id=e.profile_id and u.period_starts_at=e.period_starts_at
  where e.profile_id=public.current_profile_id() and s.singleton;
$$;

revoke execute on function public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint) from authenticated;
revoke execute on function public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb) from public,anon;
revoke execute on function public.consume_cloud_ai_rate_limit(text,text,integer,integer) from public,anon,authenticated;
revoke execute on function public.get_my_cloud_ai_quota() from public,anon;
grant execute on function public.enqueue_cloud_generation_job_with_quota(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.consume_cloud_ai_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.get_my_cloud_ai_quota() to authenticated,service_role;

commit;
