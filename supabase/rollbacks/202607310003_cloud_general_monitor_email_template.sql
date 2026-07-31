begin;

drop function if exists public.set_cloud_general_monitor_email_template(
  uuid,text,text
);

delete from public.cloud_general_monitor_email_audit_logs
where action='update_template';
alter table public.cloud_general_monitor_email_audit_logs
  drop constraint if exists cloud_general_monitor_email_audit_logs_action_check;
alter table public.cloud_general_monitor_email_audit_logs
  add constraint cloud_general_monitor_email_audit_logs_action_check
    check (action in ('configure','replace_key'));

alter table public.cloud_general_monitor_email_settings
  drop constraint if exists cloud_general_monitor_email_subject_template_check,
  drop constraint if exists cloud_general_monitor_email_body_template_check,
  drop column if exists subject_template,
  drop column if exists body_template;

commit;
