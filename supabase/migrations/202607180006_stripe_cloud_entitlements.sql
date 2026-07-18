begin;

alter table public.cloud_ai_entitlements
  add column stripe_event_created_at timestamptz;

create table public.stripe_webhook_events (
  event_id text primary key check(char_length(event_id) between 1 and 255),
  event_type text not null check(char_length(event_type) between 1 and 150),
  event_created_at timestamptz not null,
  processed_at timestamptz not null default now(),
  result text not null check(result in('applied','ignored'))
);
alter table public.stripe_webhook_events enable row level security;
grant select,insert,update on public.stripe_webhook_events to service_role;

create or replace function public.apply_cloud_ai_subscription_event(
  p_event_id text,p_event_type text,p_event_created_at timestamptz,p_profile_id uuid,
  p_plan_key text,p_status text,p_period_starts_at timestamptz,p_period_ends_at timestamptz,
  p_stripe_customer_id text,p_stripe_subscription_id text
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_ent public.cloud_ai_entitlements%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'stripe_entitlement_not_authorized'; end if;
  if char_length(p_event_id) not between 1 and 255 or char_length(p_event_type) not between 1 and 150
     or p_plan_key not in('trial','creator') or p_status not in('active','trialing','past_due','canceled')
     or p_period_ends_at<=p_period_starts_at or nullif(trim(p_stripe_customer_id),'') is null
     or nullif(trim(p_stripe_subscription_id),'') is null then raise exception 'stripe_entitlement_input_invalid'; end if;
  if exists(select 1 from public.stripe_webhook_events where event_id=p_event_id) then return false; end if;
  select * into v_ent from public.cloud_ai_entitlements where profile_id=p_profile_id for update;
  if not found then raise exception 'stripe_entitlement_profile_not_found'; end if;
  if v_ent.source='stripe' and v_ent.stripe_event_created_at is not null and v_ent.stripe_event_created_at>=p_event_created_at then
    insert into public.stripe_webhook_events(event_id,event_type,event_created_at,result) values(p_event_id,p_event_type,p_event_created_at,'ignored');
    return false;
  end if;
  update public.cloud_ai_entitlements set plan_key=p_plan_key,status=p_status,source='stripe',period_starts_at=p_period_starts_at,period_ends_at=p_period_ends_at,stripe_customer_id=trim(p_stripe_customer_id),stripe_subscription_id=trim(p_stripe_subscription_id),stripe_event_created_at=p_event_created_at,updated_at=now() where profile_id=p_profile_id;
  insert into public.cloud_ai_usage_periods(profile_id,period_starts_at,period_ends_at,plan_key)
  values(p_profile_id,p_period_starts_at,p_period_ends_at,p_plan_key)
  on conflict(profile_id,period_starts_at) do update set period_ends_at=excluded.period_ends_at,plan_key=excluded.plan_key,updated_at=now();
  insert into public.stripe_webhook_events(event_id,event_type,event_created_at,result) values(p_event_id,p_event_type,p_event_created_at,'applied');
  return true;
end;
$$;

revoke execute on function public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.apply_cloud_ai_subscription_event(text,text,timestamptz,uuid,text,text,timestamptz,timestamptz,text,text) to service_role;

commit;
