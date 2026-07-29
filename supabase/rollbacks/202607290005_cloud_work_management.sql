begin;

drop trigger if exists cloud_projects_reset_work_management
on public.cloud_projects;
drop function if exists public.reset_cloud_work_management_on_revision();
drop function if exists public.set_cloud_work_management_status(uuid,text,text,bigint);
drop function if exists public.set_cloud_work_page_review(uuid,uuid,boolean,text);
drop table if exists public.cloud_work_page_reviews;
drop table if exists public.cloud_work_management_states;

commit;
