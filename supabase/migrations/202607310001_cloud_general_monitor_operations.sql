begin;
alter table public.cloud_general_monitor_enrollments add column if not exists onboarding_completed_at timestamptz;
alter table public.cloud_general_monitor_feedback
  add column if not exists review_status text not null default 'new' check(review_status in('new','reviewing','resolved')),
  add column if not exists admin_note text check(admin_note is null or char_length(admin_note)<=1000),
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;
create index if not exists cloud_general_monitor_feedback_review_idx on public.cloud_general_monitor_feedback(review_status,created_at desc);
create or replace function public.complete_cloud_general_monitor_onboarding() returns void language plpgsql security definer set search_path=public as $$
begin
  update public.cloud_general_monitor_enrollments set onboarding_completed_at=coalesce(onboarding_completed_at,now()),updated_at=now()
  where profile_id=public.current_profile_id() and status='active' and starts_at<=now() and expires_at>now();
  if not found then raise exception 'cloud_general_monitor_unavailable';end if;
end;$$;
revoke all on function public.complete_cloud_general_monitor_onboarding() from public,anon;
grant execute on function public.complete_cloud_general_monitor_onboarding() to authenticated,service_role;
create or replace function public.review_cloud_general_monitor_feedback(p_actor_profile_id uuid,p_feedback_id uuid,p_status text,p_admin_note text) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_admin_required';end if;
  if p_status not in('new','reviewing','resolved') or char_length(coalesce(p_admin_note,''))>1000 then raise exception 'cloud_general_monitor_input_invalid';end if;
  update public.cloud_general_monitor_feedback set review_status=p_status,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now() where id=p_feedback_id;
  if not found then raise exception 'cloud_general_monitor_feedback_not_found';end if;
end;$$;
revoke all on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) to service_role;
commit;
