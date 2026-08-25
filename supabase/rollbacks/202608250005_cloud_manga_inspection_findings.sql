begin;
do $$begin if exists(select 1 from public.cloud_manga_inspection_runs)or exists(select 1 from public.cloud_manga_inspection_findings)then raise exception'cloud_manga_inspection_findings_rollback_requires_empty_tables';end if;end$$;
drop function public.record_cloud_manga_inspection_run(uuid,uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb);drop table public.cloud_manga_inspection_findings;drop table public.cloud_manga_inspection_runs;notify pgrst,'reload schema';
commit;
