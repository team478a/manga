begin;

drop function if exists public.record_cloud_manga_quality_event(uuid,text,text);
drop table if exists public.cloud_manga_quality_logs;

commit;
