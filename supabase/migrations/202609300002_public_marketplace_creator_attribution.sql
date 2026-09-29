begin;

create or replace function public.list_public_work_creator_attributions(p_work_ids uuid[])
returns table(work_id uuid, display_name text)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select work.id,
    coalesce(nullif(btrim(to_jsonb(profile)->>'display_name'),''),'クリエイター')
  from public.works work
  join public.profiles profile on profile.id=work.creator_id
  where work.id=any(coalesce(p_work_ids,'{}'::uuid[]))
    and work.content_class='general'
    and work.is_public=true
  order by work.id
$$;

revoke all on function public.list_public_work_creator_attributions(uuid[]) from public,anon,authenticated;
grant execute on function public.list_public_work_creator_attributions(uuid[]) to anon,authenticated;

commit;
