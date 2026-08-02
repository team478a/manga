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
values (
  'black-forest-labs',
  'flux-pro-1.0-fill',
  'image',
  'background',
  'bfl-flux1-fill-2026-08',
  3,
  50000,
  'USD',
  true
)
on conflict (provider_id, model_id, job_type, pricing_version)
do update set
  credits = excluded.credits,
  max_cost_micros = excluded.max_cost_micros,
  currency = excluded.currency,
  active = excluded.active,
  updated_at = now();

commit;
