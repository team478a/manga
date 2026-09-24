begin;

drop function if exists public.record_cloud_general_monitor_expiry_email_sent(
  uuid,uuid,timestamptz
);
drop function if exists public.extend_cloud_general_monitor_expiry(
  uuid,uuid,timestamptz,text
);

delete from public.cloud_general_monitor_audit_logs
where action in ('extend_expiry','expiry_extension_email_sent');

alter table public.cloud_general_monitor_audit_logs
  drop constraint if exists cloud_general_monitor_audit_logs_action_check;
alter table public.cloud_general_monitor_audit_logs
  add constraint cloud_general_monitor_audit_logs_action_check
  check (action in (
    'activate','pause','complete','revoke','update','invite_email_sent'
  ));

commit;
