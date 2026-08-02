begin;
drop policy if exists "cloud_general_monitor_feedback_owner_insert" on public.cloud_general_monitor_feedback;
create policy "cloud_general_monitor_feedback_owner_insert"
on public.cloud_general_monitor_feedback
for insert with check(
  owner_profile_id=public.current_profile_id()
  and exists(
    select 1 from public.cloud_general_monitor_enrollments enrollment
    where enrollment.profile_id=public.current_profile_id()
      and enrollment.status='active'
      and enrollment.starts_at<=now()
      and enrollment.expires_at>now()
  )
);
drop index if exists public.cloud_general_monitor_feedback_quality_idx;
drop index if exists public.cloud_general_monitor_feedback_target_idx;
alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_page_project_fkey,
  drop constraint if exists cloud_general_monitor_feedback_provider_check,
  drop constraint if exists cloud_general_monitor_feedback_model_check,
  drop constraint if exists cloud_general_monitor_feedback_panel_id_check,
  drop constraint if exists cloud_general_monitor_feedback_panel_name_check,
  drop constraint if exists cloud_general_monitor_feedback_page_number_check,
  drop constraint if exists cloud_general_monitor_feedback_metrics_check,
  drop constraint if exists cloud_general_monitor_feedback_severity_check,
  drop constraint if exists cloud_general_monitor_feedback_issue_type_check,
  drop constraint if exists cloud_general_monitor_feedback_verdict_check,
  drop constraint if exists cloud_general_monitor_feedback_target_check,
  drop constraint if exists cloud_general_monitor_feedback_target_scope_check,
  drop column if exists generation_elapsed_ms,
  drop column if exists generation_cost_micros,
  drop column if exists generation_count,
  drop column if exists model_id,
  drop column if exists provider_id,
  drop column if exists generation_job_id,
  drop column if exists severity,
  drop column if exists issue_type,
  drop column if exists verdict,
  drop column if exists panel_name_snapshot,
  drop column if exists page_number_snapshot,
  drop column if exists panel_id,
  drop column if exists page_id,
  drop column if exists project_id,
  drop column if exists target_scope;
commit;
