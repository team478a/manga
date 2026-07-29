begin;

do $$
begin
  if exists (
    select 1
    from public.cloud_market_research_reports
    where input->>'contentClass' = 'adult'
  ) then
    raise exception 'cloud_adult_research_reports_exist';
  end if;
end $$;

drop policy if exists "cloud_market_research_owner_read"
on public.cloud_market_research_reports;

create policy "cloud_market_research_owner_read"
on public.cloud_market_research_reports
for select
using (owner_profile_id = public.current_profile_id());

drop policy if exists "cloud_market_research_owner_insert"
on public.cloud_market_research_reports;

create policy "cloud_market_research_owner_insert"
on public.cloud_market_research_reports
for insert
with check (
  owner_profile_id = public.current_profile_id()
  and status = 'completed'
  and input->>'contentClass' = 'general'
);

alter table public.cloud_market_research_reports
drop constraint if exists cloud_market_research_reports_input_check;

alter table public.cloud_market_research_reports
add constraint cloud_market_research_reports_input_check
check (
  jsonb_typeof(input) = 'object'
  and pg_column_size(input) <= 32768
  and input->>'contentClass' = 'general'
);

drop function if exists public.can_use_cloud_adult_research();
drop function if exists public.set_cloud_adult_research_enabled(uuid, boolean);
drop function if exists public.set_cloud_adult_research_entitlement(
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  text
);
drop trigger if exists cloud_adult_research_consent_audit
on public.cloud_adult_research_consents;
drop function if exists public.audit_cloud_adult_research_consent();

-- allow-destructive: rollback removes Release 1.1 tables after the adult-report guard.
drop table if exists public.cloud_adult_research_audit_logs;
drop table if exists public.cloud_adult_research_consents;
drop table if exists public.cloud_adult_research_entitlements;
drop table if exists public.cloud_adult_research_settings;

commit;
