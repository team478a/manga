begin;

alter table public.cloud_monitor_quality_review_batches
  add column if not exists target_reviewer_count smallint not null default 5;

alter table public.cloud_monitor_quality_review_batches
  drop constraint if exists cloud_monitor_quality_review_batches_target_reviewer_count_check;
alter table public.cloud_monitor_quality_review_batches
  add constraint cloud_monitor_quality_review_batches_target_reviewer_count_check
  check(target_reviewer_count between 2 and 9);

alter table public.cloud_monitor_quality_review_assignments
  drop constraint if exists cloud_monitor_quality_review_assignments_reviewer_slot_check;
alter table public.cloud_monitor_quality_review_assignments
  add constraint cloud_monitor_quality_review_assignments_reviewer_slot_check
  check(reviewer_slot in(
    'reviewer_a','reviewer_b','reviewer_c','reviewer_d','reviewer_e',
    'reviewer_f','reviewer_g','reviewer_h','reviewer_i'
  ));

create or replace function public.enforce_cloud_monitor_quality_review_panel_slot()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_target smallint;
  v_ordinal integer;
begin
  select target_reviewer_count into v_target
  from public.cloud_monitor_quality_review_batches
  where id=new.batch_id;
  v_ordinal:=array_position(
    array[
      'reviewer_a','reviewer_b','reviewer_c','reviewer_d','reviewer_e',
      'reviewer_f','reviewer_g','reviewer_h','reviewer_i'
    ]::text[],
    new.reviewer_slot
  );
  if v_target is null or v_ordinal is null or v_ordinal>v_target then
    raise exception 'monitor_quality_review_slot_outside_target';
  end if;
  return new;
end$$;

revoke all on function public.enforce_cloud_monitor_quality_review_panel_slot()
  from public,anon,authenticated;

drop trigger if exists cloud_monitor_quality_review_assignments_panel_slot
  on public.cloud_monitor_quality_review_assignments;
create trigger cloud_monitor_quality_review_assignments_panel_slot
before insert or update of batch_id,reviewer_slot
on public.cloud_monitor_quality_review_assignments
for each row execute function public.enforce_cloud_monitor_quality_review_panel_slot();

commit;
