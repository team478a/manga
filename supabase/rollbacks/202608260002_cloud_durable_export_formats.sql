begin;

do $$begin
  if exists(select 1 from public.cloud_export_jobs where format in('images','project_json')) then
    raise exception 'rollback_requires_no_extended_export_jobs';
  end if;
end$$;
alter table public.cloud_export_jobs drop constraint cloud_export_jobs_format_check;
alter table public.cloud_export_jobs add constraint cloud_export_jobs_format_check check(format in('pdf'));
update storage.buckets set allowed_mime_types=array['application/pdf','image/png','application/zip']::text[] where id='cloud-exports';

create or replace function public.create_cloud_export_job(p_project_id uuid,p_format text default 'pdf') returns uuid
language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id();v_page_ids uuid[];v_job_id uuid;v_context bigint;
begin
  if v_profile is null or p_format<>'pdf' or not public.cloud_project_can_edit(p_project_id) then raise exception 'cloud_export_invalid';end if;
  select production_context_revision into v_context from public.cloud_projects where id=p_project_id and deleted_at is null;
  select array_agg(id order by page_number) into v_page_ids from public.cloud_pages where project_id=p_project_id and deleted_at is null;
  if coalesce(cardinality(v_page_ids),0) not between 1 and 100 then raise exception 'cloud_export_page_count_invalid';end if;
  if exists(select 1 from public.cloud_pages where project_id=p_project_id and deleted_at is null and(production_status<>'finalized' or finalized_revision is distinct from revision or reviewed_context_revision is distinct from v_context)) then raise exception 'cloud_export_pages_not_finalized';end if;
  if exists(select 1 from public.cloud_generation_jobs where project_id=p_project_id and status in('queued','running')) then raise exception 'cloud_export_generation_active';end if;
  if exists(select 1 from public.cloud_export_jobs where project_id=p_project_id and status in('queued','running','paused')) then raise exception 'cloud_export_already_active';end if;
  insert into public.cloud_export_jobs(project_id,created_by_profile_id,format,page_ids,total_pages) values(p_project_id,v_profile,p_format,v_page_ids,cardinality(v_page_ids)) returning id into v_job_id;
  return v_job_id;
end$$;

commit;
