begin;

do $$
begin
  if exists(select 1 from public.cloud_work_publications where source_kind='external')
     or exists(select 1 from public.orders where publication_id is not null) then
    raise exception 'external_submission_publications_rollback_requires_empty_data';
  end if;
end;
$$;

drop function if exists public.create_external_work_publication(uuid);
drop function if exists public.set_external_submission_sample_pages(uuid,uuid[]);

alter table public.external_work_submission_events
drop constraint if exists external_work_submission_events_event_type_check;
alter table public.external_work_submission_events add constraint
external_work_submission_events_event_type_check check(event_type in(
  'created','rights_declared','status_changed','upload_registered',
  'validation_queued','validation_completed','validation_failed','pages_reordered'
));

drop trigger if exists orders_fix_publication_version on public.orders;
drop function if exists public.fix_order_publication_version();
drop index if exists public.orders_publication_idx;
alter table public.orders drop column if exists publication_id;

drop index if exists public.external_work_submissions_publication_idx;
drop index if exists public.external_work_submissions_work_idx;
alter table public.external_work_submissions
  drop column if exists publication_id,
  drop column if exists work_id;

drop index if exists public.works_external_submission_idx;
alter table public.works drop column if exists external_submission_id;

drop index if exists public.cloud_work_publications_external_submission_idx;
alter table public.cloud_work_publication_pages
  drop constraint if exists cloud_work_publication_pages_storage_bucket_check;
alter table public.cloud_work_publication_pages
  add constraint cloud_work_publication_pages_storage_bucket_check
  check(storage_bucket='digital-products');
alter table public.cloud_work_publications
  drop constraint if exists cloud_work_publications_source_check,
  drop column if exists cover_storage_path,
  drop column if exists cover_storage_bucket,
  drop column if exists external_submission_id,
  drop column if exists source_kind;
alter table public.cloud_work_publications
  alter column project_id set not null,
  alter column checkpoint_id set not null,
  alter column cover_url set not null,
  alter column pdf_bucket set not null,
  alter column pdf_storage_path set not null;

commit;
