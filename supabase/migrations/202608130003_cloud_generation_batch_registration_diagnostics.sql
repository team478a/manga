begin;

create or replace function public.create_cloud_generation_batch_targets(
  p_project_id uuid,p_page_ids uuid[],p_idempotency_key text,p_targets jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_batch uuid;
  v_count integer;
  v_valid integer;
begin
  if v_profile is null or not public.cloud_project_can_edit(p_project_id) then
    raise exception 'cloud_batch_targets_access_denied';
  end if;
  if jsonb_typeof(p_targets)<>'array' then
    raise exception 'cloud_batch_targets_payload_invalid';
  end if;
  v_count:=jsonb_array_length(p_targets);
  if v_count not between 1 and 64 then
    raise exception 'cloud_batch_targets_count_invalid';
  end if;

  with targets as (
    select * from jsonb_to_recordset(p_targets) as item(
      page_id uuid,panel_id uuid,source_page_revision integer,position integer,
      idempotency_key text,kind text,job_type text,provider_id text,model_id text,pricing_version text,
      prompt_sha256 text,input jsonb,moderation jsonb,panel_specification jsonb
    )
  )
  select count(*) into v_valid from targets target
  where target.position between 1 and v_count
    and char_length(trim(coalesce(target.idempotency_key,''))) between 1 and 200
    and target.kind='image'
    and target.job_type in('background','prop','effect','character_base')
    and char_length(trim(coalesce(target.provider_id,''))) between 1 and 100
    and char_length(trim(coalesce(target.model_id,''))) between 1 and 100
    and char_length(trim(coalesce(target.pricing_version,''))) between 1 and 100
    and target.prompt_sha256~'^[0-9a-f]{64}$'
    and target.input->>'kind'=target.kind
    and target.input->>'jobType'=target.job_type
    and nullif(trim(target.input->>'prompt'),'') is not null
    and target.moderation->>'decision'='allow'
    and target.moderation->>'policyVersion'='1'
    and target.panel_specification->>'version'='1'
    and target.panel_specification->>'panelId'=target.panel_id::text;
  if v_valid<>v_count then
    raise exception 'cloud_batch_targets_payload_invalid';
  end if;

  with targets as (
    select * from jsonb_to_recordset(p_targets) as item(
      page_id uuid,source_page_revision integer
    )
  )
  select count(*) into v_valid from targets target
  join public.cloud_pages page on page.id=target.page_id and page.project_id=p_project_id
    and page.deleted_at is null and page.revision=target.source_page_revision
  join public.cloud_canvas_snapshots snapshot on snapshot.page_id=page.id and snapshot.revision=page.revision
  where target.page_id=any(p_page_ids);
  if v_valid<>v_count then
    raise exception 'cloud_batch_targets_page_revision_invalid';
  end if;

  with targets as (
    select * from jsonb_to_recordset(p_targets) as item(
      provider_id text,model_id text,job_type text,kind text,pricing_version text
    )
  )
  select count(*) into v_valid from targets target
  where exists(select 1 from public.cloud_ai_provider_prices price
    where price.provider_id=trim(target.provider_id) and price.model_id=trim(target.model_id)
      and price.job_type=target.job_type and price.kind=target.kind and price.active
      and price.pricing_version=trim(target.pricing_version));
  if v_valid<>v_count then
    raise exception 'cloud_batch_targets_pricing_invalid';
  end if;

  with targets as (
    select * from jsonb_to_recordset(p_targets) as item(
      page_id uuid,panel_id uuid,source_page_revision integer
    )
  )
  select count(*) into v_valid from targets target
  join public.cloud_canvas_snapshots snapshot
    on snapshot.page_id=target.page_id and snapshot.revision=target.source_page_revision
  where exists(
    select 1 from jsonb_array_elements(coalesce(snapshot.canvas->'panels','[]'::jsonb)) panel
    where panel->>'id'=target.panel_id::text
  );
  if v_valid<>v_count then
    raise exception 'cloud_batch_targets_panel_invalid';
  end if;

  if (select count(distinct (item->>'position')::integer) from jsonb_array_elements(p_targets) item)<>v_count
    or (select count(distinct concat(item->>'page_id',':',item->>'panel_id')) from jsonb_array_elements(p_targets) item)<>v_count
  then
    raise exception 'cloud_batch_targets_uniqueness_invalid';
  end if;

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
  if (select count(*) from public.cloud_generation_batch_targets where batch_id=v_batch)<>v_count then
    raise exception 'cloud_batch_targets_insert_invalid';
  end if;
  return v_batch;
end $$;

revoke all on function public.create_cloud_generation_batch_targets(uuid,uuid[],text,jsonb) from public,anon;
grant execute on function public.create_cloud_generation_batch_targets(uuid,uuid[],text,jsonb) to authenticated,service_role;

-- Manual Production migration application can leave PostgREST's function
-- signature cache stale. Request a schema refresh without changing the RPC.
notify pgrst, 'reload schema';

commit;
