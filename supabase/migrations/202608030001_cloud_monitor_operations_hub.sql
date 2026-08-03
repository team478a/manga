begin;

alter table public.cloud_general_monitor_feedback
  add column if not exists request_type text not null default 'feedback',
  add column if not exists title text,
  add column if not exists page_url text,
  add column if not exists environment text,
  add column if not exists triage_fingerprint text;

alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_request_type_check,
  add constraint cloud_general_monitor_feedback_request_type_check
    check(request_type in('feedback','bug','improvement','feature_request')),
  drop constraint if exists cloud_general_monitor_feedback_title_check,
  add constraint cloud_general_monitor_feedback_title_check
    check(title is null or char_length(title) between 1 and 160),
  drop constraint if exists cloud_general_monitor_feedback_page_url_check,
  add constraint cloud_general_monitor_feedback_page_url_check
    check(page_url is null or char_length(page_url)<=500),
  drop constraint if exists cloud_general_monitor_feedback_environment_check,
  add constraint cloud_general_monitor_feedback_environment_check
    check(environment is null or char_length(environment)<=200),
  drop constraint if exists cloud_general_monitor_feedback_triage_fingerprint_check,
  add constraint cloud_general_monitor_feedback_triage_fingerprint_check
    check(triage_fingerprint is null or char_length(triage_fingerprint)=32);

create index if not exists cloud_general_monitor_feedback_request_idx
  on public.cloud_general_monitor_feedback(request_type,created_at desc);
create index if not exists cloud_general_monitor_feedback_fingerprint_idx
  on public.cloud_general_monitor_feedback(triage_fingerprint,created_at desc)
  where triage_fingerprint is not null;

create table if not exists public.cloud_product_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(title) between 1 and 120),
  summary text not null check(char_length(summary) between 1 and 500),
  details text check(details is null or char_length(details)<=5000),
  category text not null check(category in('release','improvement','fix','maintenance')),
  action_url text check(action_url is null or char_length(action_url)<=500),
  published_at timestamptz,
  archived_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_product_updates_published_idx
  on public.cloud_product_updates(published_at desc)
  where published_at is not null and archived_at is null;

alter table public.cloud_product_updates enable row level security;
grant select on public.cloud_product_updates to authenticated;
grant select,insert,update,delete on public.cloud_product_updates to service_role;

drop policy if exists "cloud_product_updates_authenticated_read" on public.cloud_product_updates;
create policy "cloud_product_updates_authenticated_read"
on public.cloud_product_updates for select
using(published_at is not null and published_at<=now() and archived_at is null);

create table if not exists public.cloud_monitor_issue_tasks (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check(char_length(fingerprint)=32),
  request_type text not null check(request_type in('bug','improvement','feature_request')),
  workflow_step text not null,
  priority text not null check(priority in('low','medium','high','critical')),
  status text not null default 'detected'
    check(status in('detected','queued','claimed','fix_ready','review_required','resolved','rejected','failed')),
  primary_feedback_id uuid references public.cloud_general_monitor_feedback(id) on delete set null,
  latest_feedback_id uuid references public.cloud_general_monitor_feedback(id) on delete set null,
  occurrence_count integer not null default 1 check(occurrence_count>=1),
  first_reported_at timestamptz not null default now(),
  last_reported_at timestamptz not null default now(),
  claimed_by text check(claimed_by is null or char_length(claimed_by)<=200),
  claimed_at timestamptz,
  reproduction_summary text check(reproduction_summary is null or char_length(reproduction_summary)<=3000),
  suggested_test_scope text check(suggested_test_scope is null or char_length(suggested_test_scope)<=1000),
  github_issue_url text check(github_issue_url is null or char_length(github_issue_url)<=500),
  draft_pr_url text check(draft_pr_url is null or char_length(draft_pr_url)<=500),
  last_error text check(last_error is null or char_length(last_error)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_monitor_issue_tasks_status_idx
  on public.cloud_monitor_issue_tasks(status,priority,last_reported_at desc);

alter table public.cloud_monitor_issue_tasks enable row level security;
grant select on public.cloud_monitor_issue_tasks to authenticated;
grant select,insert,update,delete on public.cloud_monitor_issue_tasks to service_role;

drop policy if exists "cloud_monitor_issue_tasks_admin_read" on public.cloud_monitor_issue_tasks;
create policy "cloud_monitor_issue_tasks_admin_read"
on public.cloud_monitor_issue_tasks for select
using(public.is_admin());

create or replace function public.prepare_cloud_monitor_feedback_triage()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.request_type='feedback' then
    new.triage_fingerprint=null;
    return new;
  end if;
  new.triage_fingerprint=md5(
    concat_ws('|',
      new.request_type,
      new.workflow_step,
      lower(regexp_replace(coalesce(new.title,''),'\s+',' ','g')),
      lower(regexp_replace(coalesce(new.page_url,''),'[?#].*$','','g'))
    )
  );
  return new;
end;
$$;

create or replace function public.enqueue_cloud_monitor_issue_task()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_priority text;
begin
  if new.request_type='feedback' or new.triage_fingerprint is null then
    return new;
  end if;
  v_priority=case
    when new.severity='blocked' then 'critical'
    when new.severity='major' or new.rating<=1 then 'high'
    when new.request_type='bug' or new.rating<=2 then 'medium'
    else 'low'
  end;
  insert into public.cloud_monitor_issue_tasks(
    fingerprint,request_type,workflow_step,priority,status,
    primary_feedback_id,latest_feedback_id,occurrence_count,
    first_reported_at,last_reported_at,created_at,updated_at
  ) values(
    new.triage_fingerprint,new.request_type,new.workflow_step,v_priority,
    case when new.request_type='feature_request' then 'review_required' else 'detected' end,
    new.id,new.id,1,new.created_at,new.created_at,now(),now()
  )
  on conflict(fingerprint) do update set
    latest_feedback_id=excluded.latest_feedback_id,
    occurrence_count=public.cloud_monitor_issue_tasks.occurrence_count+1,
    last_reported_at=excluded.last_reported_at,
    priority=case
      when public.cloud_monitor_issue_tasks.priority='critical' or excluded.priority='critical' then 'critical'
      when public.cloud_monitor_issue_tasks.priority='high' or excluded.priority='high' then 'high'
      when public.cloud_monitor_issue_tasks.priority='medium' or excluded.priority='medium' then 'medium'
      else 'low'
    end,
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists cloud_monitor_feedback_prepare_triage on public.cloud_general_monitor_feedback;
create trigger cloud_monitor_feedback_prepare_triage
before insert on public.cloud_general_monitor_feedback
for each row execute function public.prepare_cloud_monitor_feedback_triage();

drop trigger if exists cloud_monitor_feedback_enqueue_issue on public.cloud_general_monitor_feedback;
create trigger cloud_monitor_feedback_enqueue_issue
after insert on public.cloud_general_monitor_feedback
for each row execute function public.enqueue_cloud_monitor_issue_task();

revoke all on function public.prepare_cloud_monitor_feedback_triage() from public,anon,authenticated;
revoke all on function public.enqueue_cloud_monitor_issue_task() from public,anon,authenticated;

create or replace function public.claim_cloud_monitor_issue_task(p_worker_id text)
returns setof public.cloud_monitor_issue_tasks
language plpgsql
security definer
set search_path=public
as $$
declare
  v_task_id uuid;
begin
  if auth.role()<>'service_role' or char_length(trim(coalesce(p_worker_id,''))) not between 1 and 200 then
    raise exception 'cloud_monitor_issue_worker_not_authorized';
  end if;
  select id into v_task_id
  from public.cloud_monitor_issue_tasks
  where status='queued'
  order by case priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
    last_reported_at asc
  for update skip locked
  limit 1;
  if v_task_id is null then return;end if;
  return query
    update public.cloud_monitor_issue_tasks
    set status='claimed',claimed_by=trim(p_worker_id),claimed_at=now(),updated_at=now(),last_error=null
    where id=v_task_id
    returning *;
end;
$$;

create or replace function public.complete_cloud_monitor_issue_task(
  p_task_id uuid,
  p_status text,
  p_reproduction_summary text,
  p_suggested_test_scope text,
  p_github_issue_url text,
  p_draft_pr_url text,
  p_last_error text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.role()<>'service_role' or p_status not in('fix_ready','review_required','failed') then
    raise exception 'cloud_monitor_issue_worker_not_authorized';
  end if;
  update public.cloud_monitor_issue_tasks set
    status=p_status,
    reproduction_summary=nullif(trim(coalesce(p_reproduction_summary,'')),''),
    suggested_test_scope=nullif(trim(coalesce(p_suggested_test_scope,'')),''),
    github_issue_url=nullif(trim(coalesce(p_github_issue_url,'')),''),
    draft_pr_url=nullif(trim(coalesce(p_draft_pr_url,'')),''),
    last_error=nullif(trim(coalesce(p_last_error,'')),''),
    updated_at=now()
  where id=p_task_id and status='claimed';
  if not found then raise exception 'cloud_monitor_issue_task_not_claimed';end if;
end;
$$;

revoke all on function public.claim_cloud_monitor_issue_task(text) from public,anon,authenticated;
revoke all on function public.complete_cloud_monitor_issue_task(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_cloud_monitor_issue_task(text) to service_role;
grant execute on function public.complete_cloud_monitor_issue_task(uuid,text,text,text,text,text,text) to service_role;

commit;
