begin;

do $$
begin
  if exists(select 1 from public.external_work_submission_files)
     or exists(select 1 from public.external_work_submission_pages)
     or exists(select 1 from public.external_submission_ingest_jobs)
     or exists(select 1 from storage.objects where bucket_id in(
       'external-submission-quarantine','external-submission-pages'
     )) then
    raise exception 'external_submission_ingest_rollback_requires_empty_tables';
  end if;
end;
$$;

drop function if exists public.reorder_external_submission_pages(uuid,uuid[]);
drop function if exists public.fail_external_submission_ingest(uuid,uuid,text,boolean);
drop function if exists public.complete_external_submission_ingest(uuid,uuid,jsonb);
drop function if exists public.claim_external_submission_ingest(text,integer);
drop function if exists public.queue_external_submission_validation(uuid);
drop function if exists public.register_external_submission_upload(uuid,uuid,text,text,text,bigint,text);
drop policy if exists "external_submission_quarantine_insert" on storage.objects;
drop policy if exists "external_submission_quarantine_owner_delete" on storage.objects;
drop policy if exists "external_submission_quarantine_owner_read" on storage.objects;
drop policy if exists "external_submission_pages_owner_read" on storage.objects;
drop table if exists public.external_submission_ingest_jobs;
drop table if exists public.external_work_submission_pages;
drop table if exists public.external_work_submission_files;
delete from storage.buckets where id in('external-submission-quarantine','external-submission-pages');

alter table public.external_work_submission_events
drop constraint if exists external_work_submission_events_event_type_check;
alter table public.external_work_submission_events add constraint
external_work_submission_events_event_type_check check(event_type in(
  'created','rights_declared','status_changed'
));

commit;
