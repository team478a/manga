begin;
drop function if exists public.delete_cloud_plot_thread(uuid,uuid);
drop function if exists public.save_cloud_plot_thread(uuid,uuid,text,integer,integer,integer,text,text);
drop function if exists public.delete_cloud_continuity_fact(uuid,uuid);
drop function if exists public.save_cloud_continuity_fact(uuid,uuid,text,text,text,text,integer,integer,integer,text);
drop table if exists public.cloud_plot_threads;
drop table if exists public.cloud_continuity_facts;
commit;
