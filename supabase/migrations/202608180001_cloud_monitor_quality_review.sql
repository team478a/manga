begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'manga-quality-review',
  'manga-quality-review',
  false,
  8388608,
  array['image/png','image/jpeg','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.cloud_monitor_quality_review_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique check(batch_code ~ '^batch_[a-z0-9][a-z0-9_-]{2,63}$'),
  status text not null default 'draft' check(status in('draft','active','paused','completed')),
  review_scope text not null default 'PILOT_INTRINSIC_ONLY' check(review_scope='PILOT_INTRINSIC_ONLY'),
  source_package_sha256 text not null check(source_package_sha256 ~ '^[0-9a-f]{64}$'),
  rights_reviewed_at timestamptz not null,
  rights_reviewed_by text not null check(char_length(rights_reviewed_by) between 3 and 120),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(expires_at>starts_at)
);

create table if not exists public.cloud_monitor_quality_review_cases (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.cloud_monitor_quality_review_batches(id) on delete cascade,
  case_key text not null check(case_key ~ '^case_[0-9]{6}$'),
  display_order integer not null check(display_order between 1 and 140),
  review_mode text not null default 'intrinsic_only' check(review_mode='intrinsic_only'),
  allowed_defect_categories text[] not null check(
    cardinality(allowed_defect_categories)>0
    and allowed_defect_categories <@ array[
      'anatomy_hand_error','anatomy_body_distortion','object_fusion',
      'unwanted_text','unwanted_ui','unwanted_logo','crop_error',
      'orientation_error','gravity_error','low_readability','other'
    ]::text[]
  ),
  candidate_storage_path text not null unique check(
    candidate_storage_path ~ '^[0-9a-f-]{36}/case_[0-9]{6}\.(png|jpg|jpeg|webp)$'
  ),
  candidate_sha256 text not null check(candidate_sha256 ~ '^[0-9a-f]{64}$'),
  candidate_width integer not null check(candidate_width between 100 and 20000),
  candidate_height integer not null check(candidate_height between 100 and 20000),
  created_at timestamptz not null default now(),
  unique(batch_id,case_key),
  unique(batch_id,display_order)
);

create table if not exists public.cloud_monitor_quality_review_assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.cloud_monitor_quality_review_batches(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id) on delete restrict,
  reviewer_slot text not null check(reviewer_slot in('reviewer_a','reviewer_b')),
  status text not null default 'assigned' check(status in('assigned','in_progress','submitted','revoked')),
  consent_version text check(consent_version is null or consent_version='monitor-quality-review-consent-v1'),
  consented_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  assigned_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id,reviewer_profile_id),
  unique(batch_id,reviewer_slot),
  check((consent_version is null)=(consented_at is null)),
  check((status='submitted')=(submitted_at is not null))
);

create table if not exists public.cloud_monitor_quality_review_responses (
  assignment_id uuid not null references public.cloud_monitor_quality_review_assignments(id) on delete cascade,
  case_id uuid not null references public.cloud_monitor_quality_review_cases(id) on delete cascade,
  response_payload jsonb not null default '{"verdict":null,"confidence":null,"defects":[],"overall_comment":""}'::jsonb
    check(jsonb_typeof(response_payload)='object' and octet_length(response_payload::text)<=12000),
  case_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(assignment_id,case_id)
);

create index if not exists cloud_monitor_quality_review_assignments_reviewer_idx
  on public.cloud_monitor_quality_review_assignments(reviewer_profile_id,status,updated_at desc);
create index if not exists cloud_monitor_quality_review_responses_progress_idx
  on public.cloud_monitor_quality_review_responses(assignment_id,case_completed_at);

alter table public.cloud_monitor_quality_review_batches enable row level security;
alter table public.cloud_monitor_quality_review_cases enable row level security;
alter table public.cloud_monitor_quality_review_assignments enable row level security;
alter table public.cloud_monitor_quality_review_responses enable row level security;

revoke all on public.cloud_monitor_quality_review_batches,
  public.cloud_monitor_quality_review_cases,
  public.cloud_monitor_quality_review_assignments,
  public.cloud_monitor_quality_review_responses from public,anon,authenticated;
grant select,insert,update,delete on public.cloud_monitor_quality_review_batches,
  public.cloud_monitor_quality_review_cases,
  public.cloud_monitor_quality_review_assignments,
  public.cloud_monitor_quality_review_responses to service_role;

create or replace function public.consent_cloud_monitor_quality_review(p_assignment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile uuid:=public.current_profile_id();
begin
  if v_profile is null or not public.can_use_cloud_general_monitor() then
    raise exception 'monitor_quality_review_unavailable';
  end if;
  update public.cloud_monitor_quality_review_assignments a
  set consent_version='monitor-quality-review-consent-v1',consented_at=coalesce(consented_at,now()),updated_at=now()
  from public.cloud_monitor_quality_review_batches b
  where a.id=p_assignment_id and a.reviewer_profile_id=v_profile
    and a.batch_id=b.id and a.status in('assigned','in_progress')
    and b.status='active' and b.starts_at<=now() and b.expires_at>now();
  if not found then raise exception 'monitor_quality_review_assignment_unavailable';end if;
end$$;

create or replace function public.save_cloud_monitor_quality_review_case(
  p_assignment_id uuid,p_case_id uuid,p_payload jsonb,p_complete boolean
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile uuid:=public.current_profile_id();v_case public.cloud_monitor_quality_review_cases%rowtype;
  v_verdict text;v_confidence integer;v_defect jsonb;
begin
  if v_profile is null or not public.can_use_cloud_general_monitor() then
    raise exception 'monitor_quality_review_unavailable';
  end if;
  if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000
    or p_payload-array['verdict','confidence','defects','overall_comment']::text[]<>'{}'::jsonb
    or jsonb_typeof(coalesce(p_payload->'defects','[]'::jsonb))<>'array'
    or char_length(coalesce(p_payload->>'overall_comment',''))>2000
  then raise exception 'monitor_quality_review_input_invalid';end if;
  select c.* into v_case
  from public.cloud_monitor_quality_review_assignments a
  join public.cloud_monitor_quality_review_batches b on b.id=a.batch_id
  join public.cloud_monitor_quality_review_cases c on c.batch_id=b.id and c.id=p_case_id
  where a.id=p_assignment_id and a.reviewer_profile_id=v_profile
    and a.status in('assigned','in_progress') and a.consented_at is not null
    and b.status='active' and b.starts_at<=now() and b.expires_at>now()
  for update of a;
  if not found then raise exception 'monitor_quality_review_case_unavailable';end if;
  if jsonb_array_length(coalesce(p_payload->'defects','[]'::jsonb))>30 then
    raise exception 'monitor_quality_review_input_invalid';end if;
  for v_defect in select value from jsonb_array_elements(coalesce(p_payload->'defects','[]'::jsonb)) loop
    if jsonb_typeof(v_defect)<>'object'
      or v_defect-array['category','severity','comment']::text[]<>'{}'::jsonb
      or v_defect->>'category'<>all(v_case.allowed_defect_categories)
      or v_defect->>'severity' not in('minor','major','critical')
      or char_length(coalesce(v_defect->>'comment',''))>1000
    then raise exception 'monitor_quality_review_input_invalid';end if;
  end loop;
  if p_complete then
    if coalesce(p_payload->>'verdict','') not in('good','borderline','bad')
      or coalesce(p_payload->>'confidence','') !~ '^[1-5]$'
    then raise exception 'monitor_quality_review_completion_invalid';end if;
    v_verdict:=p_payload->>'verdict';v_confidence:=(p_payload->>'confidence')::integer;
    if (v_verdict='good' and jsonb_array_length(p_payload->'defects')>0)
      or (v_verdict='bad' and jsonb_array_length(p_payload->'defects')=0)
      or (v_verdict='borderline' and jsonb_array_length(p_payload->'defects')=0 and nullif(trim(coalesce(p_payload->>'overall_comment','')),'') is null)
    then raise exception 'monitor_quality_review_completion_invalid';end if;
  end if;
  insert into public.cloud_monitor_quality_review_responses(assignment_id,case_id,response_payload,case_completed_at)
  values(p_assignment_id,p_case_id,p_payload,case when p_complete then now() else null end)
  on conflict(assignment_id,case_id) do update set
    response_payload=excluded.response_payload,
    case_completed_at=case when p_complete then coalesce(cloud_monitor_quality_review_responses.case_completed_at,now()) else null end,
    updated_at=now();
  update public.cloud_monitor_quality_review_assignments set
    status='in_progress',started_at=coalesce(started_at,now()),updated_at=now()
  where id=p_assignment_id;
end$$;

create or replace function public.submit_cloud_monitor_quality_review(p_assignment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile uuid:=public.current_profile_id();v_expected integer;v_completed integer;
begin
  if v_profile is null or not public.can_use_cloud_general_monitor() then
    raise exception 'monitor_quality_review_unavailable';end if;
  select count(*) into v_expected from public.cloud_monitor_quality_review_assignments a
  join public.cloud_monitor_quality_review_batches b on b.id=a.batch_id
  join public.cloud_monitor_quality_review_cases c on c.batch_id=b.id
  where a.id=p_assignment_id and a.reviewer_profile_id=v_profile and a.status in('assigned','in_progress')
    and a.consented_at is not null and b.status='active' and b.starts_at<=now() and b.expires_at>now();
  select count(*) into v_completed from public.cloud_monitor_quality_review_responses
  where assignment_id=p_assignment_id and case_completed_at is not null;
  if v_expected=0 or v_completed<>v_expected then raise exception 'monitor_quality_review_incomplete';end if;
  update public.cloud_monitor_quality_review_assignments set status='submitted',submitted_at=now(),updated_at=now()
  where id=p_assignment_id and reviewer_profile_id=v_profile;
  if not found then raise exception 'monitor_quality_review_assignment_unavailable';end if;
end$$;

revoke all on function public.consent_cloud_monitor_quality_review(uuid),
  public.save_cloud_monitor_quality_review_case(uuid,uuid,jsonb,boolean),
  public.submit_cloud_monitor_quality_review(uuid) from public,anon;
grant execute on function public.consent_cloud_monitor_quality_review(uuid),
  public.save_cloud_monitor_quality_review_case(uuid,uuid,jsonb,boolean),
  public.submit_cloud_monitor_quality_review(uuid) to authenticated,service_role;

commit;
