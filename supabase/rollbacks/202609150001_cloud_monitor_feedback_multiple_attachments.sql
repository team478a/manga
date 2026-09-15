begin;

update public.cloud_general_monitor_feedback
set attachment_path=attachment_paths[1]
where attachment_path is null
  and cardinality(attachment_paths)>0;

alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_attachment_paths_check,
  drop column if exists attachment_paths;

commit;
