begin;

create table if not exists public.marketplace_favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint marketplace_favorites_profile_work_key unique (profile_id, work_id)
);

create index if not exists marketplace_favorites_profile_created_idx
on public.marketplace_favorites (profile_id, created_at desc);

alter table public.marketplace_favorites enable row level security;

revoke all on public.marketplace_favorites from public, anon;
grant select, insert, delete on public.marketplace_favorites to authenticated;
grant select, insert, update, delete on public.marketplace_favorites to service_role;

drop policy if exists "marketplace_favorites_owner_read" on public.marketplace_favorites;
create policy "marketplace_favorites_owner_read"
on public.marketplace_favorites
for select
using (profile_id = public.current_profile_id());

drop policy if exists "marketplace_favorites_owner_insert" on public.marketplace_favorites;
create policy "marketplace_favorites_owner_insert"
on public.marketplace_favorites
for insert
with check (
  profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.works work
    where work.id = work_id
      and work.is_public = true
      and work.content_class = 'general'
  )
);

drop policy if exists "marketplace_favorites_owner_delete" on public.marketplace_favorites;
create policy "marketplace_favorites_owner_delete"
on public.marketplace_favorites
for delete
using (profile_id = public.current_profile_id());

commit;
