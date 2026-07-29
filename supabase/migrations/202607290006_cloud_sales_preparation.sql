begin;

create table public.cloud_sales_preparations (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.cloud_projects(id) on delete cascade,
  project_revision bigint not null check (project_revision >= 0),
  work_id uuid not null references public.works(id),
  product_id uuid not null references public.digital_products(id),
  price integer not null check (price between 0 and 1000000),
  cover_url text not null check (char_length(cover_url) between 1 and 4096),
  product_path text not null check (char_length(product_path) between 1 and 4096),
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id),
  unique(work_id),
  unique(product_id)
);

create index cloud_sales_preparations_owner_idx
on public.cloud_sales_preparations(owner_profile_id,synced_at desc);

alter table public.cloud_sales_preparations enable row level security;
grant select on public.cloud_sales_preparations to authenticated;
grant select,insert,update,delete on public.cloud_sales_preparations to service_role;

create policy "cloud_sales_preparations_owner_read"
on public.cloud_sales_preparations for select
using(owner_profile_id=public.current_profile_id());

create or replace function public.sync_cloud_sales_preparation(
  p_project_id uuid,
  p_expected_revision bigint,
  p_cover_url text,
  p_product_path text,
  p_price integer,
  p_sales_description text
) returns table(work_id uuid,product_id uuid)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid:=public.current_profile_id();
  v_project public.cloud_projects%rowtype;
  v_approval public.cloud_work_management_states%rowtype;
  v_synced record;
begin
  if v_profile_id is null then
    raise exception 'cloud_sales_auth_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,1));
  select * into v_project
  from public.cloud_projects
  where id=p_project_id
    and owner_profile_id=v_profile_id
    and content_class='general'
    and deleted_at is null
  for update;
  if not found then
    raise exception 'cloud_sales_project_not_found';
  end if;
  if v_project.revision<>p_expected_revision then
    raise exception 'cloud_sales_revision_conflict';
  end if;
  select * into v_approval
  from public.cloud_work_management_states
  where project_id=p_project_id
    and owner_profile_id=v_profile_id
  for update;
  if not found
     or v_approval.status<>'approved'
     or v_approval.expected_project_revision<>v_project.revision then
    raise exception 'cloud_sales_approval_required';
  end if;

  select * into v_synced
  from public.sync_cloud_marketplace_draft(
    p_project_id,
    p_expected_revision,
    p_cover_url,
    p_product_path,
    p_price,
    p_sales_description
  );
  if v_synced.work_id is null or v_synced.product_id is null then
    raise exception 'cloud_sales_sync_failed';
  end if;

  insert into public.cloud_sales_preparations(
    owner_profile_id,project_id,project_revision,work_id,product_id,
    price,cover_url,product_path,synced_at,updated_at
  ) values (
    v_profile_id,p_project_id,v_project.revision,
    v_synced.work_id,v_synced.product_id,p_price,
    p_cover_url,p_product_path,now(),now()
  )
  on conflict(project_id) do update set
    owner_profile_id=excluded.owner_profile_id,
    project_revision=excluded.project_revision,
    work_id=excluded.work_id,
    product_id=excluded.product_id,
    price=excluded.price,
    cover_url=excluded.cover_url,
    product_path=excluded.product_path,
    synced_at=excluded.synced_at,
    updated_at=excluded.updated_at;

  return query select v_synced.work_id::uuid,v_synced.product_id::uuid;
end;
$$;

revoke execute on function public.sync_cloud_marketplace_draft(uuid,bigint,text,text,integer,text)
from authenticated;
revoke all on function public.sync_cloud_sales_preparation(uuid,bigint,text,text,integer,text)
from public,anon;
grant execute on function public.sync_cloud_sales_preparation(uuid,bigint,text,text,integer,text)
to authenticated,service_role;

commit;
