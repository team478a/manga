begin;

create table public.cloud_market_research_reports (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status = 'completed'),
  input jsonb not null check (
    jsonb_typeof(input) = 'object'
    and pg_column_size(input) <= 32768
    and input->>'contentClass' = 'general'
  ),
  sources jsonb not null check (
    jsonb_typeof(sources) = 'array'
    and jsonb_array_length(sources) between 1 and 5
    and pg_column_size(sources) <= 65536
  ),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result->>'containsGeneratedMarketNumbers' = 'false'
    and pg_column_size(result) <= 131072
  ),
  engine_version text not null check (engine_version = 'research-rules-v1'),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index cloud_market_research_owner_idx
on public.cloud_market_research_reports(owner_profile_id, created_at desc);

alter table public.cloud_market_research_reports enable row level security;

grant select, insert on public.cloud_market_research_reports to authenticated;
grant select, insert, delete on public.cloud_market_research_reports to service_role;

create policy "cloud_market_research_owner_read"
on public.cloud_market_research_reports
for select
using (owner_profile_id = public.current_profile_id());

create policy "cloud_market_research_owner_insert"
on public.cloud_market_research_reports
for insert
with check (
  owner_profile_id = public.current_profile_id()
  and status = 'completed'
  and input->>'contentClass' = 'general'
);

commit;

