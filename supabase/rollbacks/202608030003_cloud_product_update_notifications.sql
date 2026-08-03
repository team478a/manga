begin;

drop trigger if exists cloud_product_update_notifications on public.cloud_product_updates;
drop function if exists public.sync_cloud_product_update_notifications();
delete from public.cloud_ai_notifications where notification_type='product_update';

alter table public.cloud_ai_notifications
  drop constraint if exists cloud_ai_notifications_notification_type_check;
alter table public.cloud_ai_notifications
  add constraint cloud_ai_notifications_notification_type_check check(notification_type in(
    'quota_warning','job_failed','budget_warning','generation_stopped',
    'monitor_report_received','monitor_report_status'
  ));

commit;
