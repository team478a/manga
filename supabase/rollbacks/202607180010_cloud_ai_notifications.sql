begin;
drop function if exists public.refresh_cloud_ai_notifications();
drop table if exists public.cloud_ai_notifications;
commit;
