begin;

do $$
begin
  if exists(select 1 from public.cloud_admin_generation_quality_reviews) then
    raise exception 'cloud_admin_generation_quality_reviews_rollback_requires_empty_table';
  end if;
end$$;

drop function if exists public.review_cloud_admin_generation_quality(uuid,text,text);
drop table if exists public.cloud_admin_generation_quality_reviews;

commit;
