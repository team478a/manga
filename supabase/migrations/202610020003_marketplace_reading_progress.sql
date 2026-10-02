begin;

create table if not exists public.marketplace_reading_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  publication_id uuid not null references public.cloud_work_publications(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, work_id, publication_id)
);

create index if not exists marketplace_reading_progress_profile_updated_idx
on public.marketplace_reading_progress (profile_id, updated_at desc);

alter table public.marketplace_reading_progress enable row level security;

-- Productionの既定権限を打ち消し、直接更新はservice roleだけに限定する。
revoke all on public.marketplace_reading_progress
from public, anon, authenticated, service_role;
grant select on public.marketplace_reading_progress to authenticated;
grant select, insert, update, delete on public.marketplace_reading_progress to service_role;

drop policy if exists "marketplace_reading_progress_owner_read" on public.marketplace_reading_progress;
create policy "marketplace_reading_progress_owner_read"
on public.marketplace_reading_progress
for select
using (profile_id = public.current_profile_id());

create or replace function public.save_marketplace_reading_progress(
  p_work_id uuid,
  p_publication_id uuid,
  p_page_number integer
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_work public.works%rowtype;
  v_full_access boolean:=false;
  v_is_sample boolean:=false;
begin
  if v_profile_id is null or p_work_id is null or p_publication_id is null
    or p_page_number is null or p_page_number<1 then
    raise exception 'marketplace_reading_progress_invalid';
  end if;

  select work.* into v_work
  from public.works work
  where work.id=p_work_id
    and work.content_class='general'
    and work.current_publication_id=p_publication_id;
  if v_work.id is null or not exists(
    select 1 from public.cloud_work_publications publication
    where publication.id=p_publication_id and publication.work_id=p_work_id
  ) then
    raise exception 'marketplace_reading_progress_invalid';
  end if;

  v_full_access:=v_work.creator_id=v_profile_id or exists(
    select 1
    from public.orders purchase
    join public.digital_products product on product.id=purchase.product_id
    where purchase.buyer_profile_id=v_profile_id
      and purchase.status='paid'
      and product.work_id=p_work_id
  );
  select page.is_sample into v_is_sample
  from public.cloud_work_publication_pages page
  where page.publication_id=p_publication_id and page.page_number=p_page_number;
  if not found then raise exception 'marketplace_reading_progress_invalid';end if;

  if not v_full_access and (
    not v_work.is_public or v_work.status<>'published' or not v_is_sample
  ) then
    raise exception 'marketplace_reading_progress_forbidden';
  end if;

  insert into public.marketplace_reading_progress(
    profile_id,work_id,publication_id,page_number,updated_at
  ) values(
    v_profile_id,p_work_id,p_publication_id,p_page_number,now()
  )
  on conflict(profile_id,work_id,publication_id) do update set
    page_number=excluded.page_number,
    updated_at=excluded.updated_at;
end$$;

revoke all on function public.save_marketplace_reading_progress(uuid,uuid,integer)
from public, anon, authenticated;
grant execute on function public.save_marketplace_reading_progress(uuid,uuid,integer)
to authenticated;

commit;
