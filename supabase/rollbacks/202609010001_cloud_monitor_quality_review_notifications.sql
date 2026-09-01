begin;
drop function if exists public.record_cloud_monitor_quality_review_notification_sent(uuid,uuid);
alter table public.cloud_monitor_quality_review_assignments
  drop column if exists notification_send_count,
  drop column if exists notification_sent_at;
commit;
