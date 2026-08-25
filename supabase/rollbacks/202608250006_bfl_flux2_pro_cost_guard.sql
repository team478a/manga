begin;

delete from public.cloud_ai_provider_prices
where provider_id = 'black-forest-labs'
  and model_id = 'flux-2-pro'
  and pricing_version = 'bfl-flux2-pro-2026-08';

commit;
