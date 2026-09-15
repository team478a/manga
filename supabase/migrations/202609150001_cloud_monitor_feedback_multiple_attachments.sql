begin;

alter table public.cloud_general_monitor_feedback
  add column if not exists attachment_paths text[] not null default '{}'::text[];

update public.cloud_general_monitor_feedback
set attachment_paths=array[attachment_path]
where attachment_path is not null
  and cardinality(attachment_paths)=0;

alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_attachment_paths_check,
  add constraint cloud_general_monitor_feedback_attachment_paths_check check(
    cardinality(attachment_paths) between 0 and 5
    and octet_length(array_to_string(attachment_paths,''))<=2500
  );

commit;
