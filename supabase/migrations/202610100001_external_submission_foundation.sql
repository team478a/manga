begin;

create table if not exists public.external_seller_profiles (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'eligible', 'suspended')),
  terms_version text,
  terms_accepted_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  suspension_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_seller_terms_pair_check check (
    (terms_version is null and terms_accepted_at is null)
    or (
      terms_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
      and terms_accepted_at is not null
    )
  ),
  constraint external_seller_approval_check check (
    status <> 'eligible'
    or (
      terms_version is not null
      and terms_accepted_at is not null
      and approved_by_profile_id is not null
      and approved_at is not null
    )
  ),
  constraint external_seller_suspension_check check (
    status <> 'suspended'
    or suspension_reason_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  )
);

create table if not exists public.external_seller_profile_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.external_seller_profiles(profile_id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('terms_accepted', 'status_changed')),
  from_status text check (from_status is null or from_status in ('draft', 'eligible', 'suspended')),
  to_status text check (to_status is null or to_status in ('draft', 'eligible', 'suspended')),
  terms_version text check (
    terms_version is null
    or terms_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  ),
  reason_code text check (
    reason_code is null
    or reason_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.external_work_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'uploading', 'validating', 'ready', 'submitted',
    'in_review', 'approved', 'rejected', 'published', 'paused'
  )),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  age_rating text not null default '全年齢'
    check (age_rating in ('全年齢', '12歳以上', '15歳以上')),
  content_class text not null default 'general' check (content_class = 'general'),
  source_format text not null check (source_format in ('pdf', 'zip', 'images')),
  submitted_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_reason_code text check (
    review_reason_code is null
    or review_reason_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  ),
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_submission_review_check check (
    (reviewed_by_profile_id is null and reviewed_at is null)
    or (reviewed_by_profile_id is not null and reviewed_at is not null)
  )
);

create table if not exists public.external_work_rights_declarations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.external_work_submissions(id) on delete restrict,
  declaration_version text not null
    check (declaration_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  declared_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  rights_holder_confirmed boolean not null,
  third_party_permissions_confirmed boolean not null,
  ai_use_disclosed boolean not null,
  adult_content_absent boolean not null,
  created_at timestamptz not null default now(),
  constraint external_rights_declaration_unique
    unique (submission_id, declaration_version)
);

create table if not exists public.external_work_submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.external_work_submissions(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'created', 'rights_declared', 'status_changed'
  )),
  from_status text check (from_status is null or from_status in (
    'draft', 'uploading', 'validating', 'ready', 'submitted',
    'in_review', 'approved', 'rejected', 'published', 'paused'
  )),
  to_status text check (to_status is null or to_status in (
    'draft', 'uploading', 'validating', 'ready', 'submitted',
    'in_review', 'approved', 'rejected', 'published', 'paused'
  )),
  reason_code text check (
    reason_code is null
    or reason_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  ),
  created_at timestamptz not null default now()
);

create index if not exists external_seller_profile_events_profile_created_idx
on public.external_seller_profile_events(profile_id, created_at desc);
create index if not exists external_work_submissions_owner_updated_idx
on public.external_work_submissions(owner_profile_id, updated_at desc);
create index if not exists external_work_submissions_review_queue_idx
on public.external_work_submissions(status, submitted_at)
where status in ('submitted', 'in_review');
create index if not exists external_work_rights_submission_created_idx
on public.external_work_rights_declarations(submission_id, created_at desc);
create index if not exists external_work_submission_events_submission_created_idx
on public.external_work_submission_events(submission_id, created_at desc);

create or replace function public.prevent_external_submission_audit_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'external_submission_audit_append_only';
end;
$$;

drop trigger if exists external_seller_profile_events_append_only
on public.external_seller_profile_events;
create trigger external_seller_profile_events_append_only
before update or delete on public.external_seller_profile_events
for each row execute function public.prevent_external_submission_audit_mutation();

drop trigger if exists external_work_rights_declarations_append_only
on public.external_work_rights_declarations;
create trigger external_work_rights_declarations_append_only
before update or delete on public.external_work_rights_declarations
for each row execute function public.prevent_external_submission_audit_mutation();

drop trigger if exists external_work_submission_events_append_only
on public.external_work_submission_events;
create trigger external_work_submission_events_append_only
before update or delete on public.external_work_submission_events
for each row execute function public.prevent_external_submission_audit_mutation();

drop trigger if exists external_seller_profiles_touch_updated_at
on public.external_seller_profiles;
create trigger external_seller_profiles_touch_updated_at
before update on public.external_seller_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists external_work_submissions_touch_updated_at
on public.external_work_submissions;
create trigger external_work_submissions_touch_updated_at
before update on public.external_work_submissions
for each row execute function public.touch_updated_at();

alter table public.external_seller_profiles enable row level security;
alter table public.external_seller_profile_events enable row level security;
alter table public.external_work_submissions enable row level security;
alter table public.external_work_rights_declarations enable row level security;
alter table public.external_work_submission_events enable row level security;

drop policy if exists "external_seller_profiles_owner_read" on public.external_seller_profiles;
create policy "external_seller_profiles_owner_read"
on public.external_seller_profiles for select
using (profile_id=public.current_profile_id() or public.is_admin());

drop policy if exists "external_seller_profile_events_owner_read" on public.external_seller_profile_events;
create policy "external_seller_profile_events_owner_read"
on public.external_seller_profile_events for select
using (profile_id=public.current_profile_id() or public.is_admin());

drop policy if exists "external_work_submissions_owner_read" on public.external_work_submissions;
create policy "external_work_submissions_owner_read"
on public.external_work_submissions for select
using (owner_profile_id=public.current_profile_id() or public.is_admin());

drop policy if exists "external_work_rights_declarations_owner_read" on public.external_work_rights_declarations;
create policy "external_work_rights_declarations_owner_read"
on public.external_work_rights_declarations for select
using (
  public.is_admin()
  or exists (
    select 1 from public.external_work_submissions submission
    where submission.id=submission_id
      and submission.owner_profile_id=public.current_profile_id()
  )
);

drop policy if exists "external_work_submission_events_owner_read" on public.external_work_submission_events;
create policy "external_work_submission_events_owner_read"
on public.external_work_submission_events for select
using (
  public.is_admin()
  or exists (
    select 1 from public.external_work_submissions submission
    where submission.id=submission_id
      and submission.owner_profile_id=public.current_profile_id()
  )
);

revoke all on public.external_seller_profiles,
  public.external_seller_profile_events,
  public.external_work_submissions,
  public.external_work_rights_declarations,
  public.external_work_submission_events
from public,anon,authenticated,service_role;
grant select on public.external_seller_profiles,
  public.external_seller_profile_events,
  public.external_work_submissions,
  public.external_work_rights_declarations,
  public.external_work_submission_events
to authenticated,service_role;

create or replace function public.accept_external_seller_terms(p_terms_version text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile public.profiles%rowtype;
  v_before_status text;
begin
  select * into v_profile from public.profiles
  where id=public.current_profile_id() and role='creator';
  if not found then raise exception 'external_seller_creator_required'; end if;
  if p_terms_version is null
     or p_terms_version !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception 'external_seller_terms_invalid';
  end if;

  select status into v_before_status
  from public.external_seller_profiles
  where profile_id=v_profile.id
  for update;

  insert into public.external_seller_profiles(
    profile_id,status,terms_version,terms_accepted_at,
    approved_by_profile_id,approved_at,suspension_reason_code
  ) values(
    v_profile.id,'draft',p_terms_version,now(),null,null,null
  ) on conflict(profile_id) do update set
    status=case
      when public.external_seller_profiles.terms_version is distinct from excluded.terms_version
        then 'draft'
      else public.external_seller_profiles.status
    end,
    terms_version=excluded.terms_version,
    terms_accepted_at=excluded.terms_accepted_at,
    approved_by_profile_id=case
      when public.external_seller_profiles.terms_version is distinct from excluded.terms_version
        then null
      else public.external_seller_profiles.approved_by_profile_id
    end,
    approved_at=case
      when public.external_seller_profiles.terms_version is distinct from excluded.terms_version
        then null
      else public.external_seller_profiles.approved_at
    end,
    suspension_reason_code=case
      when public.external_seller_profiles.terms_version is distinct from excluded.terms_version
        then null
      else public.external_seller_profiles.suspension_reason_code
    end;

  insert into public.external_seller_profile_events(
    profile_id,actor_profile_id,event_type,from_status,to_status,terms_version
  ) values(
    v_profile.id,v_profile.id,'terms_accepted',v_before_status,
    (select status from public.external_seller_profiles where profile_id=v_profile.id),
    p_terms_version
  );
  return v_profile.id;
end;
$$;

create or replace function public.set_external_seller_status(
  p_profile_id uuid,
  p_status text,
  p_reason_code text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid:=public.current_profile_id();
  v_seller public.external_seller_profiles%rowtype;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'external_seller_admin_required';
  end if;
  if p_status not in ('draft','eligible','suspended') then
    raise exception 'external_seller_status_invalid';
  end if;
  if p_reason_code is not null
     and p_reason_code !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception 'external_seller_reason_invalid';
  end if;
  if p_status='suspended' and p_reason_code is null then
    raise exception 'external_seller_reason_required';
  end if;

  select * into v_seller from public.external_seller_profiles
  where profile_id=p_profile_id for update;
  if not found then raise exception 'external_seller_not_found'; end if;
  if p_status='eligible'
     and (v_seller.terms_version is null or v_seller.terms_accepted_at is null) then
    raise exception 'external_seller_terms_required';
  end if;
  if v_seller.status=p_status
     and v_seller.suspension_reason_code is not distinct from p_reason_code then
    return p_profile_id;
  end if;

  update public.external_seller_profiles set
    status=p_status,
    approved_by_profile_id=case when p_status='eligible' then v_actor else approved_by_profile_id end,
    approved_at=case when p_status='eligible' then now() else approved_at end,
    suspension_reason_code=case when p_status='suspended' then p_reason_code else null end
  where profile_id=p_profile_id;
  insert into public.external_seller_profile_events(
    profile_id,actor_profile_id,event_type,from_status,to_status,reason_code
  ) values(
    p_profile_id,v_actor,'status_changed',v_seller.status,p_status,p_reason_code
  );
  return p_profile_id;
end;
$$;

create or replace function public.create_external_work_submission(
  p_title text,
  p_description text,
  p_age_rating text,
  p_source_format text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_owner uuid:=public.current_profile_id();
  v_submission_id uuid:=gen_random_uuid();
begin
  if v_owner is null or not exists(
    select 1 from public.external_seller_profiles seller
    where seller.profile_id=v_owner and seller.status='eligible'
  ) then raise exception 'external_seller_not_eligible'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 160
     or char_length(coalesce(p_description,''))>5000
     or p_age_rating not in ('全年齢','12歳以上','15歳以上')
     or p_source_format not in ('pdf','zip','images') then
    raise exception 'external_submission_input_invalid';
  end if;

  insert into public.external_work_submissions(
    id,owner_profile_id,title,description,age_rating,content_class,source_format
  ) values(
    v_submission_id,v_owner,trim(p_title),coalesce(p_description,''),
    p_age_rating,'general',p_source_format
  );
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,to_status
  ) values(v_submission_id,v_owner,'created','draft');
  return v_submission_id;
end;
$$;

create or replace function public.record_external_work_rights_declaration(
  p_submission_id uuid,
  p_declaration_version text,
  p_rights_holder_confirmed boolean,
  p_third_party_permissions_confirmed boolean,
  p_ai_use_disclosed boolean,
  p_adult_content_absent boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_owner uuid:=public.current_profile_id();
  v_submission public.external_work_submissions%rowtype;
  v_declaration_id uuid:=gen_random_uuid();
begin
  if p_declaration_version is null
     or p_declaration_version !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception 'external_rights_version_invalid';
  end if;
  select * into v_submission from public.external_work_submissions
  where id=p_submission_id and owner_profile_id=v_owner for update;
  if not found or v_submission.status not in ('draft','ready','rejected') then
    raise exception 'external_submission_not_declarable';
  end if;
  if not exists(
    select 1 from public.external_seller_profiles seller
    where seller.profile_id=v_owner and seller.status='eligible'
  ) then raise exception 'external_seller_not_eligible'; end if;

  insert into public.external_work_rights_declarations(
    id,submission_id,declaration_version,declared_by_profile_id,
    rights_holder_confirmed,third_party_permissions_confirmed,
    ai_use_disclosed,adult_content_absent
  ) values(
    v_declaration_id,p_submission_id,p_declaration_version,v_owner,
    p_rights_holder_confirmed,p_third_party_permissions_confirmed,
    p_ai_use_disclosed,p_adult_content_absent
  );
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status
  ) values(
    p_submission_id,v_owner,'rights_declared',v_submission.status,v_submission.status
  );
  return v_declaration_id;
end;
$$;

create or replace function public.transition_external_work_submission(
  p_submission_id uuid,
  p_status text,
  p_reason_code text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid:=public.current_profile_id();
  v_role text:=auth.role();
  v_submission public.external_work_submissions%rowtype;
  v_is_admin boolean:=public.is_admin();
  v_allowed boolean:=false;
begin
  if p_status not in (
    'draft','uploading','validating','ready','submitted',
    'in_review','approved','rejected','published','paused'
  ) then raise exception 'external_submission_status_invalid'; end if;
  if p_reason_code is not null
     and p_reason_code !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception 'external_submission_reason_invalid';
  end if;
  if p_status in ('rejected','paused') and p_reason_code is null then
    raise exception 'external_submission_reason_required';
  end if;

  select * into v_submission from public.external_work_submissions
  where id=p_submission_id for update;
  if not found then raise exception 'external_submission_not_found'; end if;
  if v_submission.status=p_status then return p_submission_id; end if;

  if v_actor=v_submission.owner_profile_id then
    v_allowed:=(v_submission.status='draft' and p_status='uploading')
      or (v_submission.status in ('ready','rejected') and p_status='submitted');
  elsif v_is_admin then
    v_allowed:=(v_submission.status='submitted' and p_status='in_review')
      or (v_submission.status='in_review' and p_status in ('approved','rejected'))
      or (v_submission.status in ('approved','published') and p_status='paused');
  elsif v_role='service_role' then
    v_allowed:=(v_submission.status='uploading' and p_status='validating')
      or (v_submission.status='validating' and p_status in ('ready','rejected'));
  end if;
  if not v_allowed then raise exception 'external_submission_transition_forbidden'; end if;

  if p_status='submitted' then
    if not exists(
      select 1 from public.external_seller_profiles seller
      where seller.profile_id=v_submission.owner_profile_id and seller.status='eligible'
    ) then raise exception 'external_seller_not_eligible'; end if;
    if not exists(
      select 1
      from (
        select declaration.*
        from public.external_work_rights_declarations declaration
        where declaration.submission_id=p_submission_id
        order by declaration.created_at desc,declaration.id desc
        limit 1
      ) latest
      where latest.rights_holder_confirmed
        and latest.third_party_permissions_confirmed
        and latest.ai_use_disclosed
        and latest.adult_content_absent
    ) then raise exception 'external_rights_declaration_required'; end if;
  end if;

  update public.external_work_submissions set
    status=p_status,
    submitted_at=case when p_status='submitted' then now() else submitted_at end,
    reviewed_by_profile_id=case
      when p_status in ('approved','rejected') then v_actor
      else reviewed_by_profile_id
    end,
    reviewed_at=case
      when p_status in ('approved','rejected') then now()
      else reviewed_at
    end,
    review_reason_code=case
      when p_status in ('rejected','paused') then p_reason_code
      when p_status='approved' then null
      else review_reason_code
    end,
    version=version+1
  where id=p_submission_id;
  insert into public.external_work_submission_events(
    submission_id,actor_profile_id,event_type,from_status,to_status,reason_code
  ) values(
    p_submission_id,v_actor,'status_changed',v_submission.status,p_status,p_reason_code
  );
  return p_submission_id;
end;
$$;

revoke all on function public.prevent_external_submission_audit_mutation()
from public,anon,authenticated,service_role;
revoke all on function public.accept_external_seller_terms(text)
from public,anon,authenticated,service_role;
revoke all on function public.set_external_seller_status(uuid,text,text)
from public,anon,authenticated,service_role;
revoke all on function public.create_external_work_submission(text,text,text,text)
from public,anon,authenticated,service_role;
revoke all on function public.record_external_work_rights_declaration(
  uuid,text,boolean,boolean,boolean,boolean
) from public,anon,authenticated,service_role;
revoke all on function public.transition_external_work_submission(uuid,text,text)
from public,anon,authenticated,service_role;

grant execute on function public.accept_external_seller_terms(text) to authenticated;
grant execute on function public.set_external_seller_status(uuid,text,text) to authenticated;
grant execute on function public.create_external_work_submission(text,text,text,text) to authenticated;
grant execute on function public.record_external_work_rights_declaration(
  uuid,text,boolean,boolean,boolean,boolean
) to authenticated;
grant execute on function public.transition_external_work_submission(uuid,text,text)
to authenticated,service_role;

commit;
