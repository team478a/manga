begin;

alter table public.cloud_general_monitor_feedback
  add column if not exists target_scope text not null default 'general',
  add column if not exists project_id uuid,
  add column if not exists page_id uuid,
  add column if not exists panel_id text,
  add column if not exists page_number_snapshot integer,
  add column if not exists panel_name_snapshot text,
  add column if not exists verdict text,
  add column if not exists issue_type text,
  add column if not exists severity text,
  add column if not exists generation_job_id uuid references public.cloud_generation_jobs(id) on delete set null,
  add column if not exists provider_id text,
  add column if not exists model_id text,
  add column if not exists generation_count integer not null default 0,
  add column if not exists generation_cost_micros bigint not null default 0,
  add column if not exists generation_elapsed_ms bigint not null default 0;

alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_target_scope_check,
  add constraint cloud_general_monitor_feedback_target_scope_check
    check(target_scope in('general','page','panel')),
  drop constraint if exists cloud_general_monitor_feedback_target_check,
  add constraint cloud_general_monitor_feedback_target_check check(
    (target_scope='general' and project_id is null and page_id is null and panel_id is null)
    or
    (target_scope='page' and project_id is not null and page_id is not null and panel_id is null
      and verdict is not null and issue_type is not null and severity is not null)
    or
    (target_scope='panel' and project_id is not null and page_id is not null and panel_id is not null
      and verdict is not null and issue_type is not null and severity is not null)
  ),
  drop constraint if exists cloud_general_monitor_feedback_verdict_check,
  add constraint cloud_general_monitor_feedback_verdict_check
    check(verdict is null or verdict in('accepted','needs_revision','unusable')),
  drop constraint if exists cloud_general_monitor_feedback_issue_type_check,
  add constraint cloud_general_monitor_feedback_issue_type_check
    check(issue_type is null or issue_type in('none','face','hands','composition','consistency','text','image_quality','missing_content','operation','other')),
  drop constraint if exists cloud_general_monitor_feedback_severity_check,
  add constraint cloud_general_monitor_feedback_severity_check
    check(severity is null or severity in('none','minor','major','blocked')),
  drop constraint if exists cloud_general_monitor_feedback_metrics_check,
  add constraint cloud_general_monitor_feedback_metrics_check check(
    generation_count>=0 and generation_cost_micros>=0 and generation_elapsed_ms>=0
  ),
  drop constraint if exists cloud_general_monitor_feedback_page_number_check,
  add constraint cloud_general_monitor_feedback_page_number_check
    check(page_number_snapshot is null or page_number_snapshot>=1),
  drop constraint if exists cloud_general_monitor_feedback_panel_name_check,
  add constraint cloud_general_monitor_feedback_panel_name_check
    check(panel_name_snapshot is null or char_length(panel_name_snapshot)<=200),
  drop constraint if exists cloud_general_monitor_feedback_panel_id_check,
  add constraint cloud_general_monitor_feedback_panel_id_check
    check(panel_id is null or char_length(panel_id) between 1 and 100),
  drop constraint if exists cloud_general_monitor_feedback_provider_check,
  add constraint cloud_general_monitor_feedback_provider_check
    check(provider_id is null or char_length(provider_id)<=100),
  drop constraint if exists cloud_general_monitor_feedback_model_check,
  add constraint cloud_general_monitor_feedback_model_check
    check(model_id is null or char_length(model_id)<=200);

alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_page_project_fkey;
alter table public.cloud_general_monitor_feedback
  add constraint cloud_general_monitor_feedback_page_project_fkey
  foreign key(page_id,project_id) references public.cloud_pages(id,project_id) on delete cascade;

create index if not exists cloud_general_monitor_feedback_target_idx
  on public.cloud_general_monitor_feedback(project_id,page_id,created_at desc)
  where project_id is not null;
create index if not exists cloud_general_monitor_feedback_quality_idx
  on public.cloud_general_monitor_feedback(verdict,issue_type,created_at desc)
  where target_scope in('page','panel');

drop policy if exists "cloud_general_monitor_feedback_owner_insert"
  on public.cloud_general_monitor_feedback;
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
  and(
    (target_scope='general' and project_id is null and page_id is null and panel_id is null)
    or
    (target_scope in('page','panel') and project_id is not null and page_id is not null
      and public.cloud_project_can_edit(project_id))
  )
);

commit;
