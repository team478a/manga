begin;

drop function if exists public.sync_cloud_sales_preparation(uuid,bigint,text,text,integer,text);
drop policy if exists "cloud_sales_preparations_owner_read"
on public.cloud_sales_preparations;
drop index if exists public.cloud_sales_preparations_owner_idx;
drop table if exists public.cloud_sales_preparations;

grant execute on function public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text)
to authenticated;

commit;
