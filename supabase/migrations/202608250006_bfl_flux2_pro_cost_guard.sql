begin;

insert into public.cloud_ai_provider_prices (
  provider_id,
  model_id,
  kind,
  job_type,
  pricing_version,
  credits,
  max_cost_micros,
  currency,
  active
)
select
  'black-forest-labs',
  'flux-2-pro',
  'image',
  job_type,
  'bfl-flux2-pro-2026-08',
  2,
  180000,
  'USD',
  true
from (values ('background'), ('prop'), ('effect'), ('character_base')) jobs(job_type)
on conflict (provider_id, model_id, job_type, pricing_version)
do update set
  credits = excluded.credits,
  max_cost_micros = excluded.max_cost_micros,
  currency = excluded.currency,
  active = excluded.active,
  updated_at = now();

commit;
