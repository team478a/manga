begin;

drop function if exists public.finish_cloud_generation_job(uuid,uuid,boolean,jsonb,uuid,text,bigint,text,text,boolean);
drop function if exists public.claim_cloud_generation_job(text,integer);
drop function if exists public.cancel_cloud_generation_job(uuid);
drop function if exists public.enqueue_cloud_generation_job(uuid,uuid,text,text,text,text,text,text,jsonb,jsonb,bigint);
drop table if exists public.cloud_generation_jobs;

commit;
