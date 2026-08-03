begin;

alter table public.cloud_ai_notifications
  drop constraint if exists cloud_ai_notifications_notification_type_check;
alter table public.cloud_ai_notifications
  add constraint cloud_ai_notifications_notification_type_check check(notification_type in(
    'quota_warning','job_failed','budget_warning','generation_stopped',
    'monitor_report_received','monitor_report_status','product_update'
  ));

create or replace function public.sync_cloud_product_update_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.published_at is not null and new.published_at<=now() and new.archived_at is null then
    insert into public.cloud_ai_notifications(
      audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key
    )
    select
      'user',enrollment.profile_id,'product_update','info',new.title,new.summary,new.id::text,
      'product-update:'||new.id||':'||enrollment.profile_id
    from public.cloud_general_monitor_enrollments enrollment
    where enrollment.status='active' and enrollment.expires_at>now()
    on conflict(dedupe_key) do update set
      title=excluded.title,
      body=excluded.body,
      source_id=excluded.source_id;
  else
    delete from public.cloud_ai_notifications
    where notification_type='product_update' and source_id=new.id::text;
  end if;
  return new;
end $$;
revoke all on function public.sync_cloud_product_update_notifications() from public,anon,authenticated;

drop trigger if exists cloud_product_update_notifications on public.cloud_product_updates;
create trigger cloud_product_update_notifications
after insert or update of title,summary,published_at,archived_at on public.cloud_product_updates
for each row execute function public.sync_cloud_product_update_notifications();

commit;
