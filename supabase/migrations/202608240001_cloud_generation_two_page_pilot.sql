begin;

alter table public.cloud_generation_batches
  drop constraint if exists cloud_generation_batches_requested_page_ids_check;
alter table public.cloud_generation_batches
  add constraint cloud_generation_batches_requested_page_ids_check
  check (
    cardinality(requested_page_ids) = 2
    or cardinality(requested_page_ids) between 4 and 8
  );

create or replace function public.create_cloud_generation_batch(
  p_project_id uuid,p_page_ids uuid[],p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile uuid:=public.current_profile_id();
  v_batch uuid;
  v_distinct integer;
  v_min_page integer;
  v_max_page integer;
begin
  if v_profile is null or not public.cloud_project_can_edit(p_project_id) then
    raise exception 'cloud_batch_not_editable';
  end if;
  select count(distinct page_id) into v_distinct from unnest(p_page_ids) page_id;
  if not (cardinality(p_page_ids)=2 or cardinality(p_page_ids) between 4 and 8)
    or v_distinct<>cardinality(p_page_ids)
    or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 200 then
    raise exception 'cloud_batch_invalid';
  end if;
  if (select count(*) from public.cloud_pages
      where project_id=p_project_id and id=any(p_page_ids) and deleted_at is null)<>cardinality(p_page_ids) then
    raise exception 'cloud_batch_pages_invalid';
  end if;
  if cardinality(p_page_ids)=2 then
    select min(page_number),max(page_number) into v_min_page,v_max_page
    from public.cloud_pages
    where project_id=p_project_id and id=any(p_page_ids) and deleted_at is null;
    if v_max_page-v_min_page<>1 then
      raise exception 'cloud_batch_pilot_pages_not_consecutive';
    end if;
  end if;
  insert into public.cloud_generation_batches(project_id,created_by_profile_id,idempotency_key,requested_page_ids)
    values(p_project_id,v_profile,trim(p_idempotency_key),p_page_ids)
    on conflict(created_by_profile_id,idempotency_key) do update
      set updated_at=public.cloud_generation_batches.updated_at
    returning id into v_batch;
  return v_batch;
end$$;

revoke all on function public.create_cloud_generation_batch(uuid,uuid[],text) from public,anon;
grant execute on function public.create_cloud_generation_batch(uuid,uuid[],text) to authenticated,service_role;

comment on function public.create_cloud_generation_batch(uuid,uuid[],text) is
  'Creates an exact two-consecutive-page generation pilot or a regular four-to-eight-page generation batch.';

notify pgrst, 'reload schema';

commit;
