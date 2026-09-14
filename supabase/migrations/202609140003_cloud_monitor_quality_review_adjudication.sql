begin;

create unique index if not exists cloud_monitor_quality_review_cases_id_batch_idx
  on public.cloud_monitor_quality_review_cases(id,batch_id);

create or replace function public.cloud_monitor_quality_review_signature(p_payload jsonb)
returns text
language sql
immutable
set search_path=public,extensions,pg_temp
as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'verdict',p_payload->>'verdict',
    'defects',coalesce((
      select jsonb_agg(
        jsonb_build_array(item->>'category',item->>'severity')
        order by item->>'category',item->>'severity'
      )
      from jsonb_array_elements(coalesce(p_payload->'defects','[]'::jsonb)) item
    ),'[]'::jsonb)
  )::text,'UTF8'),'sha256'),'hex')
$$;

create or replace function public.cloud_monitor_quality_review_primary_fingerprint(
  p_batch_id uuid,p_case_id uuid
) returns text
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_a text;
  v_b text;
begin
  select public.cloud_monitor_quality_review_signature(r.response_payload)
  into v_a
  from public.cloud_monitor_quality_review_assignments a
  join public.cloud_monitor_quality_review_responses r
    on r.assignment_id=a.id and r.case_id=p_case_id
  where a.batch_id=p_batch_id and a.reviewer_slot='reviewer_a'
    and a.status='submitted' and a.submitted_at is not null
    and r.case_completed_at is not null;
  select public.cloud_monitor_quality_review_signature(r.response_payload)
  into v_b
  from public.cloud_monitor_quality_review_assignments a
  join public.cloud_monitor_quality_review_responses r
    on r.assignment_id=a.id and r.case_id=p_case_id
  where a.batch_id=p_batch_id and a.reviewer_slot='reviewer_b'
    and a.status='submitted' and a.submitted_at is not null
    and r.case_completed_at is not null;
  if v_a is null or v_b is null then
    raise exception 'monitor_quality_review_primary_responses_incomplete';
  end if;
  return encode(extensions.digest(convert_to(v_a||':'||v_b,'UTF8'),'sha256'),'hex');
end$$;

create table if not exists public.cloud_monitor_quality_review_adjudications (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null default 'mangai-monitor-review-adjudication-v1'
    check(schema_version='mangai-monitor-review-adjudication-v1'),
  batch_id uuid not null references public.cloud_monitor_quality_review_batches(id) on delete restrict,
  case_id uuid not null,
  adjudicator_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'assigned'
    check(status in('assigned','in_progress','independent_locked','submitted','abstained','revoked')),
  consent_version text check(
    consent_version is null or consent_version='monitor-quality-review-adjudication-consent-v1'
  ),
  consented_at timestamptz,
  started_at timestamptz,
  draft_payload jsonb check(
    draft_payload is null or (jsonb_typeof(draft_payload)='object' and octet_length(draft_payload::text)<=12000)
  ),
  independent_payload jsonb check(
    independent_payload is null or (jsonb_typeof(independent_payload)='object' and octet_length(independent_payload::text)<=12000)
  ),
  independent_locked_at timestamptz,
  differences_revealed_at timestamptz,
  final_payload jsonb check(
    final_payload is null or (jsonb_typeof(final_payload)='object' and octet_length(final_payload::text)<=12000)
  ),
  decision_reason text check(decision_reason is null or char_length(trim(decision_reason)) between 1 and 500),
  response_fingerprint text not null check(response_fingerprint ~ '^[0-9a-f]{64}$'),
  assignment_idempotency_key text not null unique
    check(assignment_idempotency_key ~ '^[A-Za-z0-9_-]{16,120}$'),
  assigned_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  abstained_at timestamptz,
  revoked_at timestamptz,
  revoked_by_profile_id uuid references public.profiles(id) on delete restrict,
  revocation_reason text check(
    revocation_reason is null or char_length(trim(revocation_reason)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(case_id,batch_id)
    references public.cloud_monitor_quality_review_cases(id,batch_id) on delete restrict,
  check((consent_version is null)=(consented_at is null)),
  check((independent_payload is null)=(independent_locked_at is null)),
  check(status<>'assigned' or (
    consented_at is null and started_at is null and draft_payload is null
    and independent_payload is null and differences_revealed_at is null
    and final_payload is null and decision_reason is null and submitted_at is null
    and abstained_at is null and revoked_at is null
  )),
  check(status not in('independent_locked','submitted') or independent_payload is not null),
  check(status<>'submitted' or (
    final_payload is not null and decision_reason is not null and submitted_at is not null
    and differences_revealed_at is not null and abstained_at is null and revoked_at is null
  )),
  check(status<>'abstained' or (
    decision_reason is not null and abstained_at is not null
    and final_payload is null and submitted_at is null and revoked_at is null
  )),
  check(status<>'revoked' or (
    revoked_at is not null and revoked_by_profile_id is not null and revocation_reason is not null
  )),
  check(status in('submitted','revoked') or (final_payload is null and submitted_at is null)),
  check(status in('abstained','revoked') or abstained_at is null),
  check(status='revoked' or (
    revoked_at is null and revoked_by_profile_id is null and revocation_reason is null
  ))
);

create unique index if not exists cloud_monitor_quality_review_adjudications_active_case_idx
  on public.cloud_monitor_quality_review_adjudications(batch_id,case_id)
  where status<>'revoked';
create index if not exists cloud_monitor_quality_review_adjudications_reviewer_idx
  on public.cloud_monitor_quality_review_adjudications(adjudicator_profile_id,status,updated_at desc);
create unique index if not exists cloud_monitor_quality_review_adjudications_identity_idx
  on public.cloud_monitor_quality_review_adjudications(id,batch_id,case_id);

create table if not exists public.cloud_monitor_quality_review_adjudication_events (
  id uuid primary key default gen_random_uuid(),
  adjudication_id uuid not null references public.cloud_monitor_quality_review_adjudications(id) on delete restrict,
  batch_id uuid not null references public.cloud_monitor_quality_review_batches(id) on delete restrict,
  case_id uuid not null references public.cloud_monitor_quality_review_cases(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check(event_type in(
    'assigned','consented','draft_saved','independent_locked',
    'differences_revealed','submitted','abstained','revoked'
  )),
  from_status text check(from_status is null or from_status in(
    'assigned','in_progress','independent_locked','submitted','abstained','revoked'
  )),
  to_status text not null check(to_status in(
    'assigned','in_progress','independent_locked','submitted','abstained','revoked'
  )),
  idempotency_key text not null check(idempotency_key ~ '^[A-Za-z0-9_-]{16,120}$'),
  created_at timestamptz not null default now(),
  unique(adjudication_id,event_type,idempotency_key),
  foreign key(adjudication_id,batch_id,case_id)
    references public.cloud_monitor_quality_review_adjudications(id,batch_id,case_id) on delete restrict
);

create index if not exists cloud_monitor_quality_review_adjudication_events_case_idx
  on public.cloud_monitor_quality_review_adjudication_events(batch_id,case_id,created_at);

create or replace function public.validate_cloud_monitor_quality_review_adjudication_payload(
  p_case_id uuid,p_payload jsonb,p_complete boolean
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_case public.cloud_monitor_quality_review_cases%rowtype;
  v_defect jsonb;
  v_bbox jsonb;
  v_verdict text;
begin
  select * into v_case from public.cloud_monitor_quality_review_cases where id=p_case_id;
  if not found or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000
    or p_payload-array['case_id','verdict','confidence','defects','overall_comment']::text[]<>'{}'::jsonb
    or (p_payload ? 'case_id' and p_payload->>'case_id'<>v_case.case_key)
    or (p_payload ? 'overall_comment' and char_length(coalesce(p_payload->>'overall_comment',''))>2000)
    or (p_payload ? 'defects' and jsonb_typeof(p_payload->'defects')<>'array')
  then raise exception 'monitor_quality_review_adjudication_payload_invalid';end if;
  if p_payload ? 'verdict' and p_payload->'verdict'<>'null'::jsonb
    and coalesce(p_payload->>'verdict','') not in('good','borderline','bad')
  then raise exception 'monitor_quality_review_adjudication_payload_invalid';end if;
  if p_payload ? 'confidence' and p_payload->'confidence'<>'null'::jsonb
    and coalesce(p_payload->>'confidence','') !~ '^[1-5]$'
  then raise exception 'monitor_quality_review_adjudication_payload_invalid';end if;
  if jsonb_array_length(coalesce(p_payload->'defects','[]'::jsonb))>30 then
    raise exception 'monitor_quality_review_adjudication_payload_invalid';end if;
  for v_defect in select value from jsonb_array_elements(coalesce(p_payload->'defects','[]'::jsonb)) loop
    if jsonb_typeof(v_defect)<>'object'
      or v_defect-array['category','severity','bbox','comment']::text[]<>'{}'::jsonb
      or not(v_defect ? 'category') or not(v_defect ? 'severity')
      or v_defect->>'category'<>all(v_case.allowed_defect_categories)
      or v_defect->>'severity' not in('minor','major','critical')
      or char_length(coalesce(v_defect->>'comment',''))>1000
    then raise exception 'monitor_quality_review_adjudication_payload_invalid';end if;
    v_bbox:=v_defect->'bbox';
    if v_bbox is not null and v_bbox<>'null'::jsonb then
      if jsonb_typeof(v_bbox)<>'array' or jsonb_array_length(v_bbox)<>4
        or exists(select 1 from jsonb_array_elements(v_bbox) coordinate where jsonb_typeof(coordinate)<>'number')
      then raise exception 'monitor_quality_review_adjudication_payload_invalid';end if;
      if (v_bbox->>0)::numeric<0 or (v_bbox->>0)::numeric>1
        or (v_bbox->>1)::numeric<0 or (v_bbox->>1)::numeric>1
        or (v_bbox->>2)::numeric<=0 or (v_bbox->>2)::numeric>1
        or (v_bbox->>3)::numeric<=0 or (v_bbox->>3)::numeric>1
        or (v_bbox->>0)::numeric+(v_bbox->>2)::numeric>1
        or (v_bbox->>1)::numeric+(v_bbox->>3)::numeric>1
      then raise exception 'monitor_quality_review_adjudication_payload_invalid';end if;
    end if;
  end loop;
  if p_complete then
    if not(p_payload ?& array['case_id','verdict','confidence','defects','overall_comment'])
      or p_payload->>'case_id'<>v_case.case_key
      or coalesce(p_payload->>'verdict','') not in('good','borderline','bad')
      or coalesce(p_payload->>'confidence','') !~ '^[1-5]$'
      or jsonb_typeof(p_payload->'defects')<>'array'
    then raise exception 'monitor_quality_review_adjudication_completion_invalid';end if;
    v_verdict:=p_payload->>'verdict';
    if (v_verdict='good' and jsonb_array_length(p_payload->'defects')>0)
      or (v_verdict='bad' and jsonb_array_length(p_payload->'defects')=0)
      or (v_verdict='borderline' and jsonb_array_length(p_payload->'defects')=0
        and nullif(trim(coalesce(p_payload->>'overall_comment','')),'') is null)
    then raise exception 'monitor_quality_review_adjudication_completion_invalid';end if;
  end if;
end$$;

create or replace function public.enforce_cloud_monitor_quality_review_adjudication()
returns trigger
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_batch_status text;
  v_case_key text;
  v_primary_a uuid;
  v_primary_b uuid;
  v_signature_a text;
  v_signature_b text;
begin
  if tg_op='INSERT' then
    if new.status<>'assigned' then
      raise exception 'monitor_quality_review_adjudication_initial_state_invalid';
    end if;
    select b.status,c.case_key into v_batch_status,v_case_key
    from public.cloud_monitor_quality_review_batches b
    join public.cloud_monitor_quality_review_cases c on c.batch_id=b.id
    where b.id=new.batch_id and c.id=new.case_id;
    if v_batch_status is distinct from 'completed' or v_case_key is null then
      raise exception 'monitor_quality_review_adjudication_batch_invalid';
    end if;
    if not exists(select 1 from public.profiles where id=new.assigned_by_profile_id and role='admin') then
      raise exception 'monitor_quality_review_adjudication_admin_required';
    end if;
    select a.reviewer_profile_id,public.cloud_monitor_quality_review_signature(r.response_payload)
    into v_primary_a,v_signature_a
    from public.cloud_monitor_quality_review_assignments a
    join public.cloud_monitor_quality_review_responses r
      on r.assignment_id=a.id and r.case_id=new.case_id
    where a.batch_id=new.batch_id and a.reviewer_slot='reviewer_a'
      and a.status='submitted' and a.submitted_at is not null and r.case_completed_at is not null;
    select a.reviewer_profile_id,public.cloud_monitor_quality_review_signature(r.response_payload)
    into v_primary_b,v_signature_b
    from public.cloud_monitor_quality_review_assignments a
    join public.cloud_monitor_quality_review_responses r
      on r.assignment_id=a.id and r.case_id=new.case_id
    where a.batch_id=new.batch_id and a.reviewer_slot='reviewer_b'
      and a.status='submitted' and a.submitted_at is not null and r.case_completed_at is not null;
    if v_primary_a is null or v_primary_b is null or v_primary_a=v_primary_b then
      raise exception 'monitor_quality_review_primary_responses_incomplete';
    end if;
    if new.adjudicator_profile_id in(v_primary_a,v_primary_b) then
      raise exception 'monitor_quality_review_adjudicator_not_independent';
    end if;
    if v_signature_a=v_signature_b then
      raise exception 'monitor_quality_review_adjudication_not_required';
    end if;
    new.response_fingerprint:=encode(
      extensions.digest(convert_to(v_signature_a||':'||v_signature_b,'UTF8'),'sha256'),'hex'
    );
  else
    if row(new.batch_id,new.case_id,new.adjudicator_profile_id,new.assigned_by_profile_id,
      new.assignment_idempotency_key,new.response_fingerprint,new.created_at)
      is distinct from row(old.batch_id,old.case_id,old.adjudicator_profile_id,old.assigned_by_profile_id,
      old.assignment_idempotency_key,old.response_fingerprint,old.created_at)
    then raise exception 'monitor_quality_review_adjudication_identity_immutable';end if;
    if old.independent_locked_at is not null
      and row(new.independent_payload,new.independent_locked_at)
        is distinct from row(old.independent_payload,old.independent_locked_at)
    then raise exception 'monitor_quality_review_adjudication_independent_immutable';end if;
    if old.status='submitted' and new.status<>'revoked' then
      raise exception 'monitor_quality_review_adjudication_submitted_immutable';
    end if;
    if not(
      (old.status='assigned' and new.status in('in_progress','revoked'))
      or (old.status='in_progress' and new.status in('in_progress','independent_locked','abstained','revoked'))
      or (old.status='independent_locked' and new.status in('independent_locked','submitted','abstained','revoked'))
      or (old.status in('submitted','abstained') and new.status='revoked')
    ) then raise exception 'monitor_quality_review_adjudication_transition_invalid';end if;
  end if;
  return new;
end$$;

create or replace function public.prevent_cloud_monitor_quality_review_adjudication_event_mutation()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  raise exception 'monitor_quality_review_adjudication_events_append_only';
end$$;

drop trigger if exists cloud_monitor_quality_review_adjudications_guard
  on public.cloud_monitor_quality_review_adjudications;
create trigger cloud_monitor_quality_review_adjudications_guard
before insert or update on public.cloud_monitor_quality_review_adjudications
for each row execute function public.enforce_cloud_monitor_quality_review_adjudication();

drop trigger if exists cloud_monitor_quality_review_adjudication_events_append_only
  on public.cloud_monitor_quality_review_adjudication_events;
create trigger cloud_monitor_quality_review_adjudication_events_append_only
before update or delete on public.cloud_monitor_quality_review_adjudication_events
for each row execute function public.prevent_cloud_monitor_quality_review_adjudication_event_mutation();

alter table public.cloud_monitor_quality_review_adjudications enable row level security;
alter table public.cloud_monitor_quality_review_adjudication_events enable row level security;

revoke all on public.cloud_monitor_quality_review_adjudications,
  public.cloud_monitor_quality_review_adjudication_events from public,anon,authenticated;
grant select,insert,update on public.cloud_monitor_quality_review_adjudications to service_role;
grant select,insert on public.cloud_monitor_quality_review_adjudication_events to service_role;

create or replace function public.assign_cloud_monitor_quality_review_adjudication(
  p_actor_profile_id uuid,p_batch_id uuid,p_case_id uuid,
  p_adjudicator_profile_id uuid,p_idempotency_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_existing public.cloud_monitor_quality_review_adjudications%rowtype;
  v_id uuid;
begin
  if auth.role()<>'service_role'
    or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin')
  then raise exception 'monitor_quality_review_adjudication_admin_required';end if;
  select * into v_existing from public.cloud_monitor_quality_review_adjudications
  where assignment_idempotency_key=p_idempotency_key;
  if found then
    if row(v_existing.batch_id,v_existing.case_id,v_existing.adjudicator_profile_id,v_existing.assigned_by_profile_id)
      is distinct from row(p_batch_id,p_case_id,p_adjudicator_profile_id,p_actor_profile_id)
    then raise exception 'monitor_quality_review_adjudication_idempotency_conflict';end if;
    return v_existing.id;
  end if;
  insert into public.cloud_monitor_quality_review_adjudications(
    batch_id,case_id,adjudicator_profile_id,response_fingerprint,
    assignment_idempotency_key,assigned_by_profile_id
  ) values(
    p_batch_id,p_case_id,p_adjudicator_profile_id,repeat('0',64),
    p_idempotency_key,p_actor_profile_id
  ) returning id into v_id;
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_id,p_batch_id,p_case_id,p_actor_profile_id,'assigned',null,'assigned',p_idempotency_key);
  return v_id;
end$$;

create or replace function public.consent_cloud_monitor_quality_review_adjudication(
  p_adjudication_id uuid,p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_row public.cloud_monitor_quality_review_adjudications%rowtype;
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or v_profile is null or not(public.can_use_cloud_general_monitor() or public.is_admin())
  then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if exists(select 1 from public.cloud_monitor_quality_review_adjudication_events
    where adjudication_id=p_adjudication_id and event_type='consented' and idempotency_key=p_idempotency_key)
  then return;end if;
  select * into v_row from public.cloud_monitor_quality_review_adjudications
  where id=p_adjudication_id and adjudicator_profile_id=v_profile and status='assigned' for update;
  if not found then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  update public.cloud_monitor_quality_review_adjudications set
    status='in_progress',consent_version='monitor-quality-review-adjudication-consent-v1',
    consented_at=now(),started_at=now(),updated_at=now()
  where id=v_row.id;
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_row.id,v_row.batch_id,v_row.case_id,v_profile,'consented','assigned','in_progress',p_idempotency_key);
end$$;

create or replace function public.save_cloud_monitor_quality_review_adjudication_draft(
  p_adjudication_id uuid,p_payload jsonb,p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_row public.cloud_monitor_quality_review_adjudications%rowtype;
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or v_profile is null or not(public.can_use_cloud_general_monitor() or public.is_admin())
  then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if exists(select 1 from public.cloud_monitor_quality_review_adjudication_events
    where adjudication_id=p_adjudication_id and event_type='draft_saved' and idempotency_key=p_idempotency_key)
  then return;end if;
  select * into v_row from public.cloud_monitor_quality_review_adjudications
  where id=p_adjudication_id and adjudicator_profile_id=v_profile
    and status='in_progress' and consented_at is not null for update;
  if not found then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if public.cloud_monitor_quality_review_primary_fingerprint(v_row.batch_id,v_row.case_id)
    <>v_row.response_fingerprint
  then raise exception 'monitor_quality_review_adjudication_source_changed';end if;
  perform public.validate_cloud_monitor_quality_review_adjudication_payload(v_row.case_id,p_payload,false);
  update public.cloud_monitor_quality_review_adjudications
  set draft_payload=p_payload,updated_at=now() where id=v_row.id;
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_row.id,v_row.batch_id,v_row.case_id,v_profile,'draft_saved','in_progress','in_progress',p_idempotency_key);
end$$;

create or replace function public.lock_cloud_monitor_quality_review_adjudication_independent(
  p_adjudication_id uuid,p_payload jsonb,p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_row public.cloud_monitor_quality_review_adjudications%rowtype;
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or v_profile is null or not(public.can_use_cloud_general_monitor() or public.is_admin())
  then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if exists(select 1 from public.cloud_monitor_quality_review_adjudication_events
    where adjudication_id=p_adjudication_id and event_type='independent_locked' and idempotency_key=p_idempotency_key)
  then return;end if;
  select * into v_row from public.cloud_monitor_quality_review_adjudications
  where id=p_adjudication_id and adjudicator_profile_id=v_profile
    and status='in_progress' and consented_at is not null for update;
  if not found then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if public.cloud_monitor_quality_review_primary_fingerprint(v_row.batch_id,v_row.case_id)
    <>v_row.response_fingerprint
  then raise exception 'monitor_quality_review_adjudication_source_changed';end if;
  perform public.validate_cloud_monitor_quality_review_adjudication_payload(v_row.case_id,p_payload,true);
  update public.cloud_monitor_quality_review_adjudications set
    status='independent_locked',draft_payload=p_payload,independent_payload=p_payload,
    independent_locked_at=now(),updated_at=now()
  where id=v_row.id;
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_row.id,v_row.batch_id,v_row.case_id,v_profile,
    'independent_locked','in_progress','independent_locked',p_idempotency_key);
end$$;

create or replace function public.reveal_cloud_monitor_quality_review_adjudication_differences(
  p_adjudication_id uuid,p_idempotency_key text
) returns table(case_key text,reviewer_a jsonb,reviewer_b jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_row public.cloud_monitor_quality_review_adjudications%rowtype;
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or v_profile is null or not(public.can_use_cloud_general_monitor() or public.is_admin())
  then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  select * into v_row from public.cloud_monitor_quality_review_adjudications
  where id=p_adjudication_id and adjudicator_profile_id=v_profile
    and status in('independent_locked','submitted','abstained')
    and independent_locked_at is not null for update;
  if not found then raise exception 'monitor_quality_review_adjudication_differences_locked';end if;
  if public.cloud_monitor_quality_review_primary_fingerprint(v_row.batch_id,v_row.case_id)
    <>v_row.response_fingerprint
  then raise exception 'monitor_quality_review_adjudication_source_changed';end if;
  update public.cloud_monitor_quality_review_adjudications set
    differences_revealed_at=coalesce(differences_revealed_at,now()),updated_at=now()
  where id=v_row.id and status='independent_locked';
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_row.id,v_row.batch_id,v_row.case_id,v_profile,'differences_revealed',
    v_row.status,v_row.status,p_idempotency_key)
  on conflict(adjudication_id,event_type,idempotency_key) do nothing;
  return query
  select c.case_key,
    jsonb_build_object(
      'verdict',ra.response_payload->>'verdict',
      'defects',coalesce((select jsonb_agg(jsonb_build_object(
        'category',d->>'category','severity',d->>'severity'
      ) order by d->>'category',d->>'severity')
        from jsonb_array_elements(coalesce(ra.response_payload->'defects','[]'::jsonb)) d),'[]'::jsonb)
    ),
    jsonb_build_object(
      'verdict',rb.response_payload->>'verdict',
      'defects',coalesce((select jsonb_agg(jsonb_build_object(
        'category',d->>'category','severity',d->>'severity'
      ) order by d->>'category',d->>'severity')
        from jsonb_array_elements(coalesce(rb.response_payload->'defects','[]'::jsonb)) d),'[]'::jsonb)
    )
  from public.cloud_monitor_quality_review_cases c
  join public.cloud_monitor_quality_review_assignments aa
    on aa.batch_id=c.batch_id and aa.reviewer_slot='reviewer_a'
  join public.cloud_monitor_quality_review_responses ra
    on ra.assignment_id=aa.id and ra.case_id=c.id
  join public.cloud_monitor_quality_review_assignments ab
    on ab.batch_id=c.batch_id and ab.reviewer_slot='reviewer_b'
  join public.cloud_monitor_quality_review_responses rb
    on rb.assignment_id=ab.id and rb.case_id=c.id
  where c.id=v_row.case_id;
end$$;

create or replace function public.submit_cloud_monitor_quality_review_adjudication(
  p_adjudication_id uuid,p_payload jsonb,p_decision_reason text,p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_row public.cloud_monitor_quality_review_adjudications%rowtype;
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or v_profile is null or not(public.can_use_cloud_general_monitor() or public.is_admin())
  then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if exists(select 1 from public.cloud_monitor_quality_review_adjudication_events
    where adjudication_id=p_adjudication_id and event_type='submitted' and idempotency_key=p_idempotency_key)
  then return;end if;
  select * into v_row from public.cloud_monitor_quality_review_adjudications
  where id=p_adjudication_id and adjudicator_profile_id=v_profile
    and status='independent_locked' and independent_locked_at is not null
    and differences_revealed_at is not null for update;
  if not found then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if public.cloud_monitor_quality_review_primary_fingerprint(v_row.batch_id,v_row.case_id)
    <>v_row.response_fingerprint
  then raise exception 'monitor_quality_review_adjudication_source_changed';end if;
  if char_length(trim(coalesce(p_decision_reason,''))) not between 1 and 500 then
    raise exception 'monitor_quality_review_adjudication_reason_invalid';end if;
  perform public.validate_cloud_monitor_quality_review_adjudication_payload(v_row.case_id,p_payload,true);
  update public.cloud_monitor_quality_review_adjudications set
    status='submitted',final_payload=p_payload,decision_reason=trim(p_decision_reason),
    submitted_at=now(),updated_at=now()
  where id=v_row.id;
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_row.id,v_row.batch_id,v_row.case_id,v_profile,
    'submitted','independent_locked','submitted',p_idempotency_key);
end$$;

create or replace function public.abstain_cloud_monitor_quality_review_adjudication(
  p_adjudication_id uuid,p_reason text,p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_row public.cloud_monitor_quality_review_adjudications%rowtype;
begin
  if p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or v_profile is null or not(public.can_use_cloud_general_monitor() or public.is_admin())
    or char_length(trim(coalesce(p_reason,''))) not between 1 and 500
  then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  if exists(select 1 from public.cloud_monitor_quality_review_adjudication_events
    where adjudication_id=p_adjudication_id and event_type='abstained' and idempotency_key=p_idempotency_key)
  then return;end if;
  select * into v_row from public.cloud_monitor_quality_review_adjudications
  where id=p_adjudication_id and adjudicator_profile_id=v_profile
    and status in('in_progress','independent_locked') for update;
  if not found then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  update public.cloud_monitor_quality_review_adjudications set
    status='abstained',decision_reason=trim(p_reason),abstained_at=now(),updated_at=now()
  where id=v_row.id;
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_row.id,v_row.batch_id,v_row.case_id,v_profile,
    'abstained',v_row.status,'abstained',p_idempotency_key);
end$$;

create or replace function public.revoke_cloud_monitor_quality_review_adjudication(
  p_actor_profile_id uuid,p_adjudication_id uuid,p_reason text,p_idempotency_key text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_row public.cloud_monitor_quality_review_adjudications%rowtype;
begin
  if auth.role()<>'service_role' or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,120}$'
    or char_length(trim(coalesce(p_reason,''))) not between 1 and 500
    or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin')
  then raise exception 'monitor_quality_review_adjudication_admin_required';end if;
  if exists(select 1 from public.cloud_monitor_quality_review_adjudication_events
    where adjudication_id=p_adjudication_id and event_type='revoked' and idempotency_key=p_idempotency_key)
  then return;end if;
  select * into v_row from public.cloud_monitor_quality_review_adjudications
  where id=p_adjudication_id and status<>'revoked' for update;
  if not found then raise exception 'monitor_quality_review_adjudication_unavailable';end if;
  update public.cloud_monitor_quality_review_adjudications set
    status='revoked',revoked_at=now(),revoked_by_profile_id=p_actor_profile_id,
    revocation_reason=trim(p_reason),updated_at=now()
  where id=v_row.id;
  insert into public.cloud_monitor_quality_review_adjudication_events(
    adjudication_id,batch_id,case_id,actor_profile_id,event_type,from_status,to_status,idempotency_key
  ) values(v_row.id,v_row.batch_id,v_row.case_id,p_actor_profile_id,
    'revoked',v_row.status,'revoked',p_idempotency_key);
end$$;

revoke all on function public.cloud_monitor_quality_review_signature(jsonb),
  public.cloud_monitor_quality_review_primary_fingerprint(uuid,uuid),
  public.validate_cloud_monitor_quality_review_adjudication_payload(uuid,jsonb,boolean),
  public.enforce_cloud_monitor_quality_review_adjudication(),
  public.prevent_cloud_monitor_quality_review_adjudication_event_mutation(),
  public.assign_cloud_monitor_quality_review_adjudication(uuid,uuid,uuid,uuid,text),
  public.consent_cloud_monitor_quality_review_adjudication(uuid,text),
  public.save_cloud_monitor_quality_review_adjudication_draft(uuid,jsonb,text),
  public.lock_cloud_monitor_quality_review_adjudication_independent(uuid,jsonb,text),
  public.reveal_cloud_monitor_quality_review_adjudication_differences(uuid,text),
  public.submit_cloud_monitor_quality_review_adjudication(uuid,jsonb,text,text),
  public.abstain_cloud_monitor_quality_review_adjudication(uuid,text,text),
  public.revoke_cloud_monitor_quality_review_adjudication(uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function public.assign_cloud_monitor_quality_review_adjudication(uuid,uuid,uuid,uuid,text),
  public.revoke_cloud_monitor_quality_review_adjudication(uuid,uuid,text,text)
  to service_role;
grant execute on function public.consent_cloud_monitor_quality_review_adjudication(uuid,text),
  public.save_cloud_monitor_quality_review_adjudication_draft(uuid,jsonb,text),
  public.lock_cloud_monitor_quality_review_adjudication_independent(uuid,jsonb,text),
  public.reveal_cloud_monitor_quality_review_adjudication_differences(uuid,text),
  public.submit_cloud_monitor_quality_review_adjudication(uuid,jsonb,text,text),
  public.abstain_cloud_monitor_quality_review_adjudication(uuid,text,text)
  to authenticated,service_role;

commit;
