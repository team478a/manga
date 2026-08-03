begin;
create or replace function public.review_cloud_general_monitor_feedback(p_actor_profile_id uuid,p_feedback_id uuid,p_status text,p_admin_note text) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_admin_required';end if;
  if p_status not in('new','reviewing','resolved') or char_length(coalesce(p_admin_note,''))>1000 then raise exception 'cloud_general_monitor_input_invalid';end if;
  update public.cloud_general_monitor_feedback set review_status=p_status,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now() where id=p_feedback_id;
  if not found then raise exception 'cloud_general_monitor_feedback_not_found';end if;
end;$$;
revoke all on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) to service_role;
drop trigger if exists cloud_monitor_issue_public_status on public.cloud_monitor_issue_tasks;
drop function if exists public.sync_cloud_monitor_issue_public_status();
drop trigger if exists cloud_monitor_feedback_received_notification on public.cloud_general_monitor_feedback;
drop function if exists public.notify_cloud_monitor_feedback_received();
drop trigger if exists cloud_monitor_feedback_rate_limit on public.cloud_general_monitor_feedback;
drop function if exists public.limit_cloud_monitor_feedback_rate();
alter table public.cloud_ai_notifications drop constraint if exists cloud_ai_notifications_notification_type_check;
alter table public.cloud_ai_notifications add constraint cloud_ai_notifications_notification_type_check check(notification_type in('quota_warning','job_failed','budget_warning','generation_stopped'));
drop policy if exists "monitor_feedback_owner_delete" on storage.objects;
drop policy if exists "monitor_feedback_owner_insert" on storage.objects;
drop policy if exists "monitor_feedback_owner_read" on storage.objects;
delete from storage.buckets where id='monitor-feedback';
drop index if exists public.cloud_general_monitor_feedback_public_status_idx;
alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_public_status_check,
  drop constraint if exists cloud_general_monitor_feedback_attachment_path_check,
  drop constraint if exists cloud_general_monitor_feedback_client_context_check,
  drop column if exists status_updated_at,
  drop column if exists public_status,
  drop column if exists attachment_path,
  drop column if exists client_context;
commit;
