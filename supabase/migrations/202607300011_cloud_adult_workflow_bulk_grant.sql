begin;

create or replace function public.grant_cloud_adult_workflow_access(
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_source text,
  p_valid_until timestamptz,
  p_admin_note text
) returns void language plpgsql security definer set search_path=public as $$
declare v_feature_key text;
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then raise exception 'cloud_adult_workflow_admin_required';end if;
  if p_source not in('purchase','legacy_purchase','admin_grant','campaign')
    or char_length(coalesce(p_admin_note,''))>500
  then raise exception 'cloud_adult_workflow_grant_invalid';end if;

  perform public.set_cloud_adult_research_entitlement(
    p_actor_profile_id,p_target_profile_id,'approved',p_source,
    p_valid_until,p_admin_note
  );
  foreach v_feature_key in array array[
    'adult_planning','adult_ai_planning','adult_scenario','adult_storyboard'
  ] loop
    perform public.set_cloud_adult_feature_grant(
      p_actor_profile_id,p_target_profile_id,v_feature_key,'approved',
      p_source,p_valid_until,p_admin_note
    );
  end loop;
end;
$$;
revoke all on function public.grant_cloud_adult_workflow_access(
  uuid,uuid,text,timestamptz,text
) from public,anon,authenticated;
grant execute on function public.grant_cloud_adult_workflow_access(
  uuid,uuid,text,timestamptz,text
) to service_role;

commit;
