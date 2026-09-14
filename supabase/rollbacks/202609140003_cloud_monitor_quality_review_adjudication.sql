begin;

do $$
begin
  if exists(select 1 from public.cloud_monitor_quality_review_adjudications)
    or exists(select 1 from public.cloud_monitor_quality_review_adjudication_events)
  then
    raise exception 'monitor_quality_review_adjudication_rollback_requires_empty_tables';
  end if;
end$$;

drop function if exists public.revoke_cloud_monitor_quality_review_adjudication(uuid,uuid,text,text);
drop function if exists public.abstain_cloud_monitor_quality_review_adjudication(uuid,text,text);
drop function if exists public.submit_cloud_monitor_quality_review_adjudication(uuid,jsonb,text,text);
drop function if exists public.reveal_cloud_monitor_quality_review_adjudication_differences(uuid,text);
drop function if exists public.lock_cloud_monitor_quality_review_adjudication_independent(uuid,jsonb,text);
drop function if exists public.save_cloud_monitor_quality_review_adjudication_draft(uuid,jsonb,text);
drop function if exists public.consent_cloud_monitor_quality_review_adjudication(uuid,text);
drop function if exists public.assign_cloud_monitor_quality_review_adjudication(uuid,uuid,uuid,uuid,text);

drop trigger if exists cloud_monitor_quality_review_adjudication_events_append_only
  on public.cloud_monitor_quality_review_adjudication_events;
drop trigger if exists cloud_monitor_quality_review_adjudications_guard
  on public.cloud_monitor_quality_review_adjudications;
drop function if exists public.prevent_cloud_monitor_quality_review_adjudication_event_mutation();
drop function if exists public.enforce_cloud_monitor_quality_review_adjudication();
drop function if exists public.validate_cloud_monitor_quality_review_adjudication_payload(uuid,jsonb,boolean);

drop table if exists public.cloud_monitor_quality_review_adjudication_events;
drop table if exists public.cloud_monitor_quality_review_adjudications;
drop function if exists public.cloud_monitor_quality_review_primary_fingerprint(uuid,uuid);
drop function if exists public.cloud_monitor_quality_review_signature(jsonb);
drop index if exists public.cloud_monitor_quality_review_cases_id_batch_idx;

commit;
