begin;

do $$
begin
  if to_regclass('public.cloud_general_monitor_email_settings') is not null
    and exists (
      select 1
      from public.cloud_general_monitor_email_settings
      where secret_id is not null
    )
  then
    raise exception 'cloud_general_monitor_email_secret_cleanup_required';
  end if;
end
$$;

drop function if exists
  public.get_cloud_general_monitor_email_runtime_config();
drop function if exists
  public.set_cloud_general_monitor_email_provider(uuid,text,text,text,boolean);
drop table if exists public.cloud_general_monitor_email_audit_logs;
drop table if exists public.cloud_general_monitor_email_settings;

commit;
