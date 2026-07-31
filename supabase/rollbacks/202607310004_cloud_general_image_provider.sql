begin;

do $$
begin
  if exists (
    select 1
    from public.cloud_general_image_provider_settings
    where secret_id is not null
  ) then
    raise exception 'cloud_general_image_provider_secret_must_be_removed_before_rollback';
  end if;
  if exists (
    select 1
    from public.cloud_generation_jobs
    where provider_id = 'black-forest-labs'
  ) then
    raise exception 'cloud_general_image_provider_jobs_exist';
  end if;
end $$;

delete from public.cloud_ai_provider_prices
where provider_id = 'black-forest-labs'
  and pricing_version = 'bfl-flux2-2026-03';

drop function if exists public.get_cloud_general_image_runtime_config();
drop function if exists public.set_cloud_general_image_provider(
  uuid, text, text, boolean
);
drop table if exists public.cloud_general_image_provider_audit_logs;
drop table if exists public.cloud_general_image_provider_settings;

commit;
