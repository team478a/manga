begin;

create table public.cloud_generation_batch_targets (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.cloud_generation_batches(id) on delete cascade,
  project_id uuid not null,
  page_id uuid not null,
  panel_id uuid not null,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  source_page_revision integer not null check(source_page_revision>=0),
  position integer not null check(position between 1 and 64),
  idempotency_key text not null check(char_length(idempotency_key) between 1 and 200),
  kind text not null check(kind in('image','text')),
  job_type text not null,
  provider_id text not null,
  model_id text not null,
  pricing_version text not null,
  prompt_sha256 text not null check(prompt_sha256~'^[0-9a-f]{64}$'),
  input jsonb not null,
  moderation jsonb not null,
  panel_specification jsonb not null,
  status text not null default 'pending' check(status in('pending','queued','failed','canceled')),
  generation_job_id uuid unique references public.cloud_generation_jobs(id) on delete restrict,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id,position),
  unique(batch_id,page_id,panel_id),
  foreign key(batch_id,project_id) references public.cloud_generation_batches(id,project_id) on delete cascade,
  foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade
);

create index cloud_generation_batch_targets_dispatch_idx
  on public.cloud_generation_batch_targets(status,created_at,position);
alter table public.cloud_generation_batch_targets enable row level security;
grant select,insert,update,delete on public.cloud_generation_batch_targets to service_role;

create or replace function public.create_cloud_generation_batch_targets(
  p_project_id uuid,p_page_ids uuid[],p_idempotency_key text,p_targets jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile uuid:=public.current_profile_id();v_batch uuid;v_count integer;v_valid integer;
begin
  if v_profile is null or not public.cloud_project_can_edit(p_project_id)
    or jsonb_typeof(p_targets)<>'array' then raise exception 'cloud_batch_targets_invalid';end if;
  v_count:=jsonb_array_length(p_targets);
  if v_count not between 1 and 64 then raise exception 'cloud_batch_targets_invalid';end if;

  with targets as (
    select * from jsonb_to_recordset(p_targets) as item(
      page_id uuid,panel_id uuid,source_page_revision integer,position integer,
      idempotency_key text,kind text,job_type text,provider_id text,model_id text,pricing_version text,
      prompt_sha256 text,input jsonb,moderation jsonb,panel_specification jsonb
    )
  )
  select count(*) into v_valid from targets target
  join public.cloud_pages page on page.id=target.page_id and page.project_id=p_project_id
    and page.deleted_at is null and page.revision=target.source_page_revision
  join public.cloud_canvas_snapshots snapshot on snapshot.page_id=page.id and snapshot.revision=page.revision
  where target.page_id=any(p_page_ids)
    and target.position between 1 and v_count
    and char_length(trim(coalesce(target.idempotency_key,''))) between 1 and 200
    and target.kind='image'
    and target.job_type in('background','prop','effect','character_base')
    and char_length(trim(coalesce(target.provider_id,''))) between 1 and 100
    and char_length(trim(coalesce(target.model_id,''))) between 1 and 100
    and char_length(trim(coalesce(target.pricing_version,''))) between 1 and 100
    and exists(select 1 from public.cloud_ai_provider_prices price
      where price.provider_id=trim(target.provider_id) and price.model_id=trim(target.model_id)
        and price.job_type=target.job_type and price.kind=target.kind and price.active
        and price.pricing_version=trim(target.pricing_version))
    and target.prompt_sha256~'^[0-9a-f]{64}$'
    and target.input->>'kind'=target.kind
    and target.input->>'jobType'=target.job_type
    and nullif(trim(target.input->>'prompt'),'') is not null
    and target.moderation->>'decision'='allow'
    and target.moderation->>'policyVersion'='1'
    and target.panel_specification->>'version'='1'
    and target.panel_specification->>'panelId'=target.panel_id::text
    and exists(
      select 1 from jsonb_array_elements(coalesce(snapshot.canvas->'panels','[]'::jsonb)) panel
      where panel->>'id'=target.panel_id::text
    );
  if v_valid<>v_count then raise exception 'cloud_batch_targets_invalid';end if;
  if (select count(distinct (item->>'position')::integer) from jsonb_array_elements(p_targets) item)<>v_count
    or (select count(distinct concat(item->>'page_id',':',item->>'panel_id')) from jsonb_array_elements(p_targets) item)<>v_count
    then raise exception 'cloud_batch_targets_invalid';end if;

  v_batch:=public.create_cloud_generation_batch(p_project_id,p_page_ids,p_idempotency_key);
  insert into public.cloud_generation_batch_targets(
    batch_id,project_id,page_id,panel_id,created_by_profile_id,source_page_revision,position,
    idempotency_key,kind,job_type,provider_id,model_id,pricing_version,prompt_sha256,input,moderation,panel_specification
  )
  select v_batch,p_project_id,target.page_id,target.panel_id,v_profile,target.source_page_revision,target.position,
    trim(target.idempotency_key),target.kind,target.job_type,trim(target.provider_id),trim(target.model_id),trim(target.pricing_version),
    target.prompt_sha256,target.input,target.moderation,target.panel_specification
  from jsonb_to_recordset(p_targets) as target(
    page_id uuid,panel_id uuid,source_page_revision integer,position integer,
    idempotency_key text,kind text,job_type text,provider_id text,model_id text,pricing_version text,
    prompt_sha256 text,input jsonb,moderation jsonb,panel_specification jsonb
  ) order by target.position
  on conflict(batch_id,page_id,panel_id) do nothing;
  if (select count(*) from public.cloud_generation_batch_targets where batch_id=v_batch)<>v_count
    then raise exception 'cloud_batch_targets_invalid';end if;
  return v_batch;
end $$;

create or replace function public.get_cloud_generation_batch_target_progress(p_project_id uuid)
returns table(batch_id uuid,pending_targets integer,failed_targets integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.cloud_project_can_read(p_project_id) then raise exception 'cloud_batch_not_readable';end if;
  return query select target.batch_id,
    count(*) filter(where target.status='pending')::integer,
    count(*) filter(where target.status='failed')::integer
  from public.cloud_generation_batch_targets target
  join public.cloud_generation_batches batch on batch.id=target.batch_id
  where target.project_id=p_project_id and batch.created_by_profile_id=public.current_profile_id()
  group by target.batch_id;
end $$;

create or replace function public.retry_cloud_generation_batch_targets(p_batch_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
  if not exists(select 1 from public.cloud_generation_batches where id=p_batch_id
    and created_by_profile_id=public.current_profile_id() and status in('active','paused'))
    then raise exception 'cloud_batch_not_editable';end if;
  update public.cloud_generation_batch_targets set status='pending',error_code=null,updated_at=now()
  where batch_id=p_batch_id and status='failed';
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.dispatch_next_cloud_generation_batch_target()
returns table(dispatch_status text,target_id uuid,job_id uuid,error_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_target public.cloud_generation_batch_targets%rowtype;v_auth_user uuid;v_job uuid;
  v_message text;v_safe_code text;v_original_sub text:=current_setting('request.jwt.claim.sub',true);
begin
  if auth.role()<>'service_role' then raise exception 'cloud_worker_not_authorized';end if;
  select target.* into v_target from public.cloud_generation_batch_targets target
  join public.cloud_generation_batches batch on batch.id=target.batch_id and batch.status='active'
  where target.status='pending' order by target.created_at,target.position
  for update of target skip locked limit 1;
  if v_target.id is null then
    return query select 'idle'::text,null::uuid,null::uuid,null::text;
    return;
  end if;
  if not exists(select 1 from public.cloud_pages where id=v_target.page_id and project_id=v_target.project_id
    and revision=v_target.source_page_revision and deleted_at is null) then
    update public.cloud_generation_batch_targets set status='failed',error_code='source_revision_changed',updated_at=now()
    where id=v_target.id;
    return query select 'failed'::text,v_target.id,null::uuid,'source_revision_changed'::text;
    return;
  end if;
  if not exists(select 1 from public.cloud_ai_provider_prices where provider_id=v_target.provider_id
    and model_id=v_target.model_id and job_type=v_target.job_type and kind=v_target.kind
    and pricing_version=v_target.pricing_version and active) then
    update public.cloud_generation_batch_targets set status='failed',error_code='pricing_changed',updated_at=now()
    where id=v_target.id;
    return query select 'failed'::text,v_target.id,null::uuid,'pricing_changed'::text;
    return;
  end if;
  select user_id into v_auth_user from public.profiles where id=v_target.created_by_profile_id;
  if v_auth_user is null then
    update public.cloud_generation_batch_targets set status='failed',error_code='owner_unavailable',updated_at=now()
    where id=v_target.id;
    return query select 'failed'::text,v_target.id,null::uuid,'owner_unavailable'::text;
    return;
  end if;
  begin
    perform public.consume_cloud_general_monitor_ai_request(v_target.created_by_profile_id,'panel_image');
    perform set_config('request.jwt.claim.sub',v_auth_user::text,true);
    v_job:=public.enqueue_cloud_generation_job_with_quota(
      v_target.project_id,v_target.page_id,v_target.kind,v_target.job_type,
      v_target.provider_id,v_target.model_id,v_target.idempotency_key,v_target.prompt_sha256,
      v_target.input,v_target.moderation
    );
    insert into public.cloud_generation_batch_jobs(batch_id,project_id,page_id,job_id)
      values(v_target.batch_id,v_target.project_id,v_target.page_id,v_job) on conflict do nothing;
    insert into public.cloud_manga_panel_specifications(
      generation_job_id,owner_profile_id,project_id,panel_id,specification
    ) values(v_job,v_target.created_by_profile_id,v_target.project_id,v_target.panel_id,v_target.panel_specification)
      on conflict(generation_job_id) do nothing;
    update public.cloud_generation_batch_targets set status='queued',generation_job_id=v_job,error_code=null,updated_at=now()
      where id=v_target.id;
    perform set_config('request.jwt.claim.sub',coalesce(v_original_sub,''),true);
    return query select 'dispatched'::text,v_target.id,v_job,null::text;
    return;
  exception when others then
    get stacked diagnostics v_message=message_text;
    perform set_config('request.jwt.claim.sub',coalesce(v_original_sub,''),true);
    if v_message='cloud_generation_rate_limited' then
      return query select 'deferred'::text,v_target.id,null::uuid,'rate_limited'::text;
      return;
    end if;
    v_safe_code:=case
      when v_message='cloud_general_monitor_unavailable' then 'monitor_unavailable'
      when v_message in('cloud_credit_quota_exceeded','cloud_cost_quota_exceeded','cloud_daily_budget_exceeded',
        'cloud_project_credit_limit_exceeded','cloud_project_cost_limit_exceeded','cloud_project_storage_limit_exceeded') then 'quota_unavailable'
      when v_message in('cloud_generation_disabled','cloud_project_generation_disabled') then 'generation_disabled'
      when v_message in('cloud_generation_price_unavailable','cloud_plan_unavailable','cloud_entitlement_inactive') then 'billing_unavailable'
      else 'dispatch_failed' end;
    update public.cloud_generation_batch_targets set status='failed',error_code=v_safe_code,updated_at=now()
      where id=v_target.id;
    return query select 'failed'::text,v_target.id,null::uuid,v_safe_code;
    return;
  end;
end $$;

create or replace function public.set_cloud_generation_batch_state(p_batch_id uuid,p_status text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_batch public.cloud_generation_batches%rowtype;v_job record;
begin
  select * into v_batch from public.cloud_generation_batches where id=p_batch_id and created_by_profile_id=public.current_profile_id() for update;
  if v_batch.id is null or p_status not in('active','paused','canceled') then raise exception 'cloud_batch_not_editable';end if;
  if p_status='canceled' then
    for v_job in select job_id from public.cloud_generation_batch_jobs where batch_id=v_batch.id loop
      begin perform public.cancel_cloud_generation_job(v_job.job_id); exception when others then null; end;
    end loop;
    update public.cloud_generation_batch_targets set status='canceled',updated_at=now()
      where batch_id=v_batch.id and status in('pending','failed');
  end if;
  update public.cloud_generation_batches set status=p_status,updated_at=now() where id=v_batch.id;
  return v_batch.id;
end $$;

revoke all on function public.create_cloud_generation_batch_targets(uuid,uuid[],text,jsonb) from public,anon;
revoke all on function public.get_cloud_generation_batch_target_progress(uuid) from public,anon;
revoke all on function public.retry_cloud_generation_batch_targets(uuid) from public,anon;
revoke all on function public.dispatch_next_cloud_generation_batch_target() from public,anon,authenticated;
grant execute on function public.create_cloud_generation_batch_targets(uuid,uuid[],text,jsonb) to authenticated,service_role;
grant execute on function public.get_cloud_generation_batch_target_progress(uuid) to authenticated,service_role;
grant execute on function public.retry_cloud_generation_batch_targets(uuid) to authenticated,service_role;
grant execute on function public.dispatch_next_cloud_generation_batch_target() to service_role;

commit;
