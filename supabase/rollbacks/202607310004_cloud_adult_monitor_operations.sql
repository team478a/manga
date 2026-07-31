begin;

drop function if exists public.set_cloud_adult_monitor_email_template(uuid,text,text);
drop function if exists public.review_cloud_adult_monitor_feedback(uuid,uuid,text,text);
drop function if exists public.complete_cloud_adult_monitor_onboarding();

delete from public.cloud_general_monitor_email_audit_logs
where action='update_adult_template';
alter table public.cloud_general_monitor_email_audit_logs
  drop constraint if exists cloud_general_monitor_email_audit_logs_action_check;
alter table public.cloud_general_monitor_email_audit_logs
  add constraint cloud_general_monitor_email_audit_logs_action_check
    check(action in('configure','replace_key','update_template'));

alter table public.cloud_general_monitor_email_settings
  drop constraint if exists cloud_adult_monitor_email_subject_template_check,
  drop constraint if exists cloud_adult_monitor_email_body_template_check,
  drop column if exists adult_subject_template,
  drop column if exists adult_body_template;

drop index if exists public.cloud_adult_monitor_feedback_review_idx;
alter table public.cloud_adult_monitor_feedback
  drop column if exists reviewed_at,
  drop column if exists reviewed_by_profile_id,
  drop column if exists admin_note,
  drop column if exists review_status;
alter table public.cloud_adult_monitor_enrollments
  drop column if exists onboarding_completed_at;

commit;
