begin;

drop function if exists public.record_cloud_general_monitor_invite_email_sent(
  uuid,uuid
);

delete from public.cloud_general_monitor_audit_logs
where action='invite_email_sent';

alter table public.cloud_general_monitor_audit_logs
  drop constraint if exists cloud_general_monitor_audit_logs_action_check;
alter table public.cloud_general_monitor_audit_logs
  add constraint cloud_general_monitor_audit_logs_action_check
    check (action in ('activate','pause','complete','revoke','update'));

alter table public.cloud_general_monitor_enrollments
  drop column if exists invite_email_send_count,
  drop column if exists invite_email_sent_at;

commit;
