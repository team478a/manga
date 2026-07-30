begin;

revoke execute on function public.update_cloud_adult_work(
  uuid,text,text,text,text
) from authenticated;
drop function if exists public.update_cloud_adult_work(
  uuid,text,text,text,text
);
drop trigger if exists cloud_projects_register_adult_work
on public.cloud_projects;
drop function if exists public.register_cloud_adult_work();
drop table if exists public.cloud_adult_work_records;
revoke execute on function public.set_cloud_adult_work_management_enabled(
  uuid,boolean
) from service_role;
drop function if exists public.set_cloud_adult_work_management_enabled(
  uuid,boolean
);
revoke execute on function public.can_use_cloud_adult_work_management()
from authenticated;
drop function if exists public.can_use_cloud_adult_work_management();
drop table if exists public.cloud_adult_work_management_settings;

commit;
