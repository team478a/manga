begin;

drop function if exists public.save_cloud_manga_quality_evaluation(uuid,jsonb,integer);
drop function if exists public.save_cloud_manga_panel_specification(uuid,jsonb);
drop table if exists public.cloud_manga_quality_evaluations;
drop table if exists public.cloud_manga_panel_specifications;

commit;
