begin;

revoke execute on function public.grant_cloud_adult_workflow_access(
  uuid,uuid,text,timestamptz,text
) from service_role;
drop function if exists public.grant_cloud_adult_workflow_access(
  uuid,uuid,text,timestamptz,text
);

commit;
