begin;

delete from public.cloud_ai_provider_prices
where provider_id = 'black-forest-labs'
  and model_id = 'flux-pro-1.0-fill'
  and job_type = 'background'
  and pricing_version = 'bfl-flux1-fill-2026-08';

commit;
