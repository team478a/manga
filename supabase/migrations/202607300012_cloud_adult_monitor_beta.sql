begin;

create table public.cloud_adult_monitor_enrollments (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null check (status in ('active','paused','completed','revoked')),
  cohort text not null default 'preview-01'
    check (char_length(cohort) between 1 and 80),
  ai_request_limit integer not null default 20
    check (ai_request_limit between 1 and 100),
  ai_requests_used integer not null default 0
    check (ai_requests_used between 0 and ai_request_limit),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_by_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  admin_note text check (
    admin_note is null or char_length(admin_note) <= 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table public.cloud_adult_monitor_ai_usage (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null
    references public.profiles(id) on delete cascade,
  operation text not null check (
    operation in ('research','proposal','scenario','storyboard')
  ),
  created_at timestamptz not null default now()
);

create table public.cloud_adult_monitor_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null
    references public.profiles(id) on delete cascade,
  workflow_step text not null check (
    workflow_step in (
      'overall','research','proposal','scenario','storyboard','canvas','works'
    )
  ),
  rating integer not null check (rating between 1 and 5),
  outcome text not null check (
    outcome in ('very_useful','useful','neutral','difficult','blocked')
  ),
  comment text check (
    comment is null or char_length(comment) <= 2000
  ),
  created_at timestamptz not null default now()
);

create table public.cloud_adult_monitor_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  target_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  action text not null check (
    action in ('activate','pause','complete','revoke','update')
  ),
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index cloud_adult_monitor_status_idx
on public.cloud_adult_monitor_enrollments(status, expires_at);
create index cloud_adult_monitor_usage_profile_idx
on public.cloud_adult_monitor_ai_usage(profile_id, created_at desc);
create index cloud_adult_monitor_feedback_profile_idx
on public.cloud_adult_monitor_feedback(owner_profile_id, created_at desc);
create index cloud_adult_monitor_audit_created_idx
on public.cloud_adult_monitor_audit_logs(created_at desc);

alter table public.cloud_adult_monitor_enrollments enable row level security;
alter table public.cloud_adult_monitor_ai_usage enable row level security;
alter table public.cloud_adult_monitor_feedback enable row level security;
alter table public.cloud_adult_monitor_audit_logs enable row level security;

grant select on public.cloud_adult_monitor_enrollments to authenticated;
grant select on public.cloud_adult_monitor_feedback to authenticated;
grant insert on public.cloud_adult_monitor_feedback to authenticated;
grant select,insert,update,delete
  on public.cloud_adult_monitor_enrollments,
     public.cloud_adult_monitor_ai_usage,
     public.cloud_adult_monitor_feedback,
     public.cloud_adult_monitor_audit_logs
  to service_role;

create policy "cloud_adult_monitor_enrollment_owner_read"
on public.cloud_adult_monitor_enrollments
for select using (
  profile_id=public.current_profile_id() or public.is_admin()
);

create policy "cloud_adult_monitor_feedback_owner_read"
on public.cloud_adult_monitor_feedback
for select using (
  owner_profile_id=public.current_profile_id() or public.is_admin()
);

create policy "cloud_adult_monitor_feedback_owner_insert"
on public.cloud_adult_monitor_feedback
for insert with check (
  owner_profile_id=public.current_profile_id()
  and exists (
    select 1
    from public.cloud_adult_monitor_enrollments enrollment
    where enrollment.profile_id=public.current_profile_id()
      and enrollment.status='active'
      and enrollment.starts_at<=now()
      and enrollment.expires_at>now()
  )
);

create policy "cloud_adult_monitor_audit_admin_read"
on public.cloud_adult_monitor_audit_logs
for select using (public.is_admin());

create or replace function public.can_use_cloud_adult_monitor()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.cloud_adult_monitor_enrollments enrollment
    where enrollment.profile_id=public.current_profile_id()
      and enrollment.status='active'
      and enrollment.starts_at<=now()
      and enrollment.expires_at>now()
      and enrollment.ai_requests_used<=enrollment.ai_request_limit
  );
$$;

revoke all on function public.can_use_cloud_adult_monitor()
from public,anon;
grant execute on function public.can_use_cloud_adult_monitor()
to authenticated,service_role;

create or replace function public.consume_cloud_adult_monitor_ai_request(
  p_profile_id uuid,
  p_operation text
) returns table (
  requests_used integer,
  request_limit integer
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.role()<>'service_role' then
    raise exception 'cloud_adult_monitor_service_required';
  end if;
  if p_operation not in ('research','proposal','scenario','storyboard') then
    raise exception 'cloud_adult_monitor_operation_invalid';
  end if;

  return query
  update public.cloud_adult_monitor_enrollments enrollment
  set ai_requests_used=enrollment.ai_requests_used+1,
      updated_at=now()
  where enrollment.profile_id=p_profile_id
    and enrollment.status='active'
    and enrollment.starts_at<=now()
    and enrollment.expires_at>now()
    and enrollment.ai_requests_used<enrollment.ai_request_limit
  returning enrollment.ai_requests_used,enrollment.ai_request_limit;

  if not found then
    raise exception 'cloud_adult_monitor_unavailable';
  end if;

  insert into public.cloud_adult_monitor_ai_usage(profile_id,operation)
  values(p_profile_id,p_operation);
end;
$$;

revoke all on function public.consume_cloud_adult_monitor_ai_request(uuid,text)
from public,anon,authenticated;
grant execute on function public.consume_cloud_adult_monitor_ai_request(uuid,text)
to service_role;

create or replace function public.activate_cloud_adult_monitor(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_source text,
  p_expires_at timestamptz,
  p_ai_request_limit integer,
  p_cohort text,
  p_admin_note text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if auth.role()<>'service_role' or not exists (
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then
    raise exception 'cloud_adult_monitor_admin_required';
  end if;
  if p_expires_at<=now()
    or p_ai_request_limit not between 1 and 100
    or char_length(trim(coalesce(p_cohort,''))) not between 1 and 80
    or char_length(coalesce(p_admin_note,''))>500
  then
    raise exception 'cloud_adult_monitor_input_invalid';
  end if;

  select to_jsonb(enrollment) into v_before
  from public.cloud_adult_monitor_enrollments enrollment
  where enrollment.profile_id=p_target_profile_id;

  perform public.grant_cloud_adult_workflow_access(
    p_actor_profile_id,p_target_profile_id,p_source,p_expires_at,p_admin_note
  );

  insert into public.cloud_adult_monitor_enrollments(
    profile_id,status,cohort,ai_request_limit,ai_requests_used,
    starts_at,expires_at,granted_by_profile_id,admin_note
  ) values(
    p_target_profile_id,'active',trim(p_cohort),p_ai_request_limit,0,
    now(),p_expires_at,p_actor_profile_id,nullif(trim(p_admin_note),'')
  )
  on conflict(profile_id) do update set
    status='active',
    cohort=excluded.cohort,
    ai_request_limit=excluded.ai_request_limit,
    ai_requests_used=0,
    starts_at=now(),
    expires_at=excluded.expires_at,
    granted_by_profile_id=excluded.granted_by_profile_id,
    admin_note=excluded.admin_note,
    updated_at=now();

  select to_jsonb(enrollment) into v_after
  from public.cloud_adult_monitor_enrollments enrollment
  where enrollment.profile_id=p_target_profile_id;

  insert into public.cloud_adult_monitor_audit_logs(
    actor_profile_id,target_profile_id,action,before_value,after_value
  ) values(
    p_actor_profile_id,p_target_profile_id,
    case when v_before is null then 'activate' else 'update' end,
    v_before,v_after
  );
end;
$$;

revoke all on function public.activate_cloud_adult_monitor(
  uuid,uuid,text,timestamptz,integer,text,text
) from public,anon,authenticated;
grant execute on function public.activate_cloud_adult_monitor(
  uuid,uuid,text,timestamptz,integer,text,text
) to service_role;

create or replace function public.stop_cloud_adult_monitor(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_status text,
  p_admin_note text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_feature_key text;
  v_before jsonb;
  v_after jsonb;
  v_source text;
begin
  if auth.role()<>'service_role' or not exists (
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then
    raise exception 'cloud_adult_monitor_admin_required';
  end if;
  if p_status not in ('paused','completed','revoked')
    or char_length(coalesce(p_admin_note,''))>500
  then
    raise exception 'cloud_adult_monitor_input_invalid';
  end if;

  select to_jsonb(enrollment) into v_before
  from public.cloud_adult_monitor_enrollments enrollment
  where enrollment.profile_id=p_target_profile_id
  for update;
  if v_before is null then
    raise exception 'cloud_adult_monitor_not_found';
  end if;

  select entitlement.source into v_source
  from public.cloud_adult_research_entitlements entitlement
  where entitlement.profile_id=p_target_profile_id;
  v_source:=coalesce(v_source,'admin_grant');

  perform public.set_cloud_adult_research_entitlement(
    p_actor_profile_id,p_target_profile_id,'suspended',v_source,
    null,p_admin_note
  );
  foreach v_feature_key in array array[
    'adult_planning','adult_ai_planning','adult_scenario','adult_storyboard'
  ] loop
    perform public.set_cloud_adult_feature_grant(
      p_actor_profile_id,p_target_profile_id,v_feature_key,'suspended',
      v_source,null,p_admin_note
    );
  end loop;

  update public.cloud_adult_monitor_enrollments
  set status=p_status,
      admin_note=nullif(trim(p_admin_note),''),
      updated_at=now()
  where profile_id=p_target_profile_id;

  select to_jsonb(enrollment) into v_after
  from public.cloud_adult_monitor_enrollments enrollment
  where enrollment.profile_id=p_target_profile_id;
  insert into public.cloud_adult_monitor_audit_logs(
    actor_profile_id,target_profile_id,action,before_value,after_value
  ) values(
    p_actor_profile_id,p_target_profile_id,
    case p_status
      when 'paused' then 'pause'
      when 'completed' then 'complete'
      else 'revoke'
    end,
    v_before,v_after
  );
end;
$$;

revoke all on function public.stop_cloud_adult_monitor(
  uuid,uuid,text,text
) from public,anon,authenticated;
grant execute on function public.stop_cloud_adult_monitor(
  uuid,uuid,text,text
) to service_role;

create or replace function public.can_use_cloud_adult_research()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.can_use_cloud_adult_monitor() and exists (
    select 1
    from public.cloud_adult_research_settings settings
    join public.cloud_adult_research_entitlements entitlement on true
    join public.cloud_adult_research_consents consent
      on consent.profile_id=entitlement.profile_id
    where settings.singleton
      and settings.enabled
      and entitlement.profile_id=public.current_profile_id()
      and entitlement.status='approved'
      and (
        entitlement.valid_until is null
        or entitlement.valid_until>now()
      )
      and consent.terms_version='adult-research-v1'
      and consent.withdrawn_at is null
  );
$$;

grant execute on function public.can_use_cloud_adult_research()
to authenticated;

commit;
