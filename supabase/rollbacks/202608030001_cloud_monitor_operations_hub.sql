begin;
drop function if exists public.complete_cloud_monitor_issue_task(uuid,text,text,text,text,text,text);
drop function if exists public.claim_cloud_monitor_issue_task(text);
drop trigger if exists cloud_monitor_feedback_enqueue_issue on public.cloud_general_monitor_feedback;
drop trigger if exists cloud_monitor_feedback_prepare_triage on public.cloud_general_monitor_feedback;
drop function if exists public.enqueue_cloud_monitor_issue_task();
drop function if exists public.prepare_cloud_monitor_feedback_triage();
drop policy if exists "cloud_monitor_issue_tasks_admin_read" on public.cloud_monitor_issue_tasks;
drop table if exists public.cloud_monitor_issue_tasks;
drop policy if exists "cloud_product_updates_authenticated_read" on public.cloud_product_updates;
drop table if exists public.cloud_product_updates;
drop index if exists public.cloud_general_monitor_feedback_fingerprint_idx;
drop index if exists public.cloud_general_monitor_feedback_request_idx;
alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_triage_fingerprint_check,
  drop constraint if exists cloud_general_monitor_feedback_environment_check,
  drop constraint if exists cloud_general_monitor_feedback_page_url_check,
  drop constraint if exists cloud_general_monitor_feedback_title_check,
  drop constraint if exists cloud_general_monitor_feedback_request_type_check,
  drop column if exists triage_fingerprint,
  drop column if exists environment,
  drop column if exists page_url,
  drop column if exists title,
  drop column if exists request_type;
commit;
