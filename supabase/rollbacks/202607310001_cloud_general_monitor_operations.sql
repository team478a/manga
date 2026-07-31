begin;
drop function if exists public.review_cloud_general_monitor_feedback(uuid,uuid,text,text);
drop function if exists public.complete_cloud_general_monitor_onboarding();
drop index if exists public.cloud_general_monitor_feedback_review_idx;
alter table if exists public.cloud_general_monitor_feedback drop column if exists reviewed_at,drop column if exists reviewed_by_profile_id,drop column if exists admin_note,drop column if exists review_status;
alter table if exists public.cloud_general_monitor_enrollments drop column if exists onboarding_completed_at;
commit;
