begin;

drop function if exists public.save_marketplace_reading_progress(uuid,uuid,integer);
drop table if exists public.marketplace_reading_progress;

commit;
