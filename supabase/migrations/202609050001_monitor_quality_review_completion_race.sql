begin;

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
    response_payload=case
      when cloud_monitor_quality_review_responses.case_completed_at is not null and not p_complete
        then cloud_monitor_quality_review_responses.response_payload
      else excluded.response_payload
    end,
    case_completed_at=case
      when cloud_monitor_quality_review_responses.case_completed_at is not null and not p_complete
        then cloud_monitor_quality_review_responses.case_completed_at
      when p_complete then coalesce(cloud_monitor_quality_review_responses.case_completed_at,now())
      else null
    end,
    updated_at=now();
  update public.cloud_monitor_quality_review_assignments set
    status='in_progress',started_at=coalesce(started_at,now()),updated_at=now()
  where id=p_assignment_id;
end$$;

revoke all on function public.save_cloud_monitor_quality_review_case(uuid,uuid,jsonb,boolean)
  from public,anon;
grant execute on function public.save_cloud_monitor_quality_review_case(uuid,uuid,jsonb,boolean)
  to authenticated,service_role;

commit;
