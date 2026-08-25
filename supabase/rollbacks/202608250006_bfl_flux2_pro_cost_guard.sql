begin;

delete from public.cloud_ai_provider_prices
where provider_id = 'black-forest-labs'
  and model_id = 'flux-2-pro'
  and pricing_version = 'bfl-flux2-pro-2026-08';

update public.cloud_ai_provider_prices
set active = true,
    updated_at = now()
where provider_id = 'black-forest-labs'
  and model_id = 'flux-2-pro'
  and job_type in ('background', 'prop', 'effect', 'character_base')
  and pricing_version = 'bfl-flux2-2026-03';

commit;
