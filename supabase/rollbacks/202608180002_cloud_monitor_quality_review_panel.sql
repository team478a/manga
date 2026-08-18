begin;

do $$
begin
  if exists(
    select 1 from public.cloud_monitor_quality_review_assignments
    where reviewer_slot not in('reviewer_a','reviewer_b')
  ) then
    raise exception 'monitor_quality_review_panel_rollback_requires_no_panel_assignments';
  end if;
end$$;

drop trigger if exists cloud_monitor_quality_review_assignments_panel_slot
  on public.cloud_monitor_quality_review_assignments;
drop function if exists public.enforce_cloud_monitor_quality_review_panel_slot();

alter table public.cloud_monitor_quality_review_assignments
  drop constraint if exists cloud_monitor_quality_review_assignments_reviewer_slot_check;
alter table public.cloud_monitor_quality_review_assignments
  add constraint cloud_monitor_quality_review_assignments_reviewer_slot_check
  check(reviewer_slot in('reviewer_a','reviewer_b'));

alter table public.cloud_monitor_quality_review_batches
  drop constraint if exists cloud_monitor_quality_review_batches_target_reviewer_count_check;
alter table public.cloud_monitor_quality_review_batches
  drop column if exists target_reviewer_count;

commit;
