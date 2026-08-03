begin;

alter table public.cloud_general_monitor_feedback
  add column if not exists client_context jsonb not null default '{}'::jsonb,
  add column if not exists attachment_path text,
  add column if not exists public_status text not null default 'submitted',
  add column if not exists status_updated_at timestamptz not null default now();

alter table public.cloud_general_monitor_feedback
  drop constraint if exists cloud_general_monitor_feedback_client_context_check,
  add constraint cloud_general_monitor_feedback_client_context_check
    check(jsonb_typeof(client_context)='object' and octet_length(client_context::text)<=10000),
  drop constraint if exists cloud_general_monitor_feedback_attachment_path_check,
  add constraint cloud_general_monitor_feedback_attachment_path_check
    check(attachment_path is null or char_length(attachment_path) between 1 and 500),
  drop constraint if exists cloud_general_monitor_feedback_public_status_check,
  add constraint cloud_general_monitor_feedback_public_status_check
    check(public_status in('submitted','triaged','in_progress','resolved','closed'));

create index if not exists cloud_general_monitor_feedback_public_status_idx
  on public.cloud_general_monitor_feedback(public_status,status_updated_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('monitor-feedback','monitor-feedback',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

drop policy if exists "monitor_feedback_owner_read" on storage.objects;
create policy "monitor_feedback_owner_read" on storage.objects for select to authenticated
using(bucket_id='monitor-feedback' and (storage.foldername(name))[1]=public.current_profile_id()::text);
drop policy if exists "monitor_feedback_owner_insert" on storage.objects;
create policy "monitor_feedback_owner_insert" on storage.objects for insert to authenticated
with check(bucket_id='monitor-feedback' and (storage.foldername(name))[1]=public.current_profile_id()::text);
drop policy if exists "monitor_feedback_owner_delete" on storage.objects;
create policy "monitor_feedback_owner_delete" on storage.objects for delete to authenticated
using(bucket_id='monitor-feedback' and (storage.foldername(name))[1]=public.current_profile_id()::text);

alter table public.cloud_ai_notifications
  drop constraint if exists cloud_ai_notifications_notification_type_check;
alter table public.cloud_ai_notifications
  add constraint cloud_ai_notifications_notification_type_check check(notification_type in(
    'quota_warning','job_failed','budget_warning','generation_stopped',
    'monitor_report_received','monitor_report_status'
  ));

create or replace function public.limit_cloud_monitor_feedback_rate()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(new.target_scope,'general')<>'general' then return new;end if;
  if (select count(*) from public.cloud_general_monitor_feedback
      where owner_profile_id=new.owner_profile_id and target_scope='general'
        and created_at>=now()-interval '10 minutes')>=5
     or (select count(*) from public.cloud_general_monitor_feedback
      where owner_profile_id=new.owner_profile_id and target_scope='general'
        and created_at>=now()-interval '24 hours')>=30 then
    raise exception 'cloud_monitor_feedback_rate_limited';
  end if;
  return new;
end $$;
revoke all on function public.limit_cloud_monitor_feedback_rate() from public,anon,authenticated;

drop trigger if exists cloud_monitor_feedback_rate_limit on public.cloud_general_monitor_feedback;
create trigger cloud_monitor_feedback_rate_limit before insert on public.cloud_general_monitor_feedback
for each row execute function public.limit_cloud_monitor_feedback_rate();

create or replace function public.notify_cloud_monitor_feedback_received()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(new.target_scope,'general')='general' then
    insert into public.cloud_ai_notifications(
      audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key
    ) values(
      'user',new.owner_profile_id,'monitor_report_received','info','ご報告を受け付けました',
      '内容を確認し、状況が変わった時に通知します。',new.id::text,'monitor:received:'||new.id
    ) on conflict(dedupe_key) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.notify_cloud_monitor_feedback_received() from public,anon,authenticated;

drop trigger if exists cloud_monitor_feedback_received_notification on public.cloud_general_monitor_feedback;
create trigger cloud_monitor_feedback_received_notification after insert on public.cloud_general_monitor_feedback
for each row execute function public.notify_cloud_monitor_feedback_received();

create or replace function public.sync_cloud_monitor_issue_public_status()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_public_status text;v_title text;v_body text;
begin
  if new.status=old.status then return new;end if;
  v_public_status=case
    when new.status in('detected','queued','review_required','failed') then 'triaged'
    when new.status in('claimed','fix_ready') then 'in_progress'
    when new.status='resolved' then 'resolved'
    when new.status='rejected' then 'closed'
    else 'submitted' end;
  update public.cloud_general_monitor_feedback
  set public_status=v_public_status,status_updated_at=now()
  where triage_fingerprint=new.fingerprint;
  v_title=case v_public_status when 'resolved' then 'ご報告への対応が完了しました' when 'closed' then 'ご報告の確認が完了しました' when 'in_progress' then 'ご報告への対応を進めています' else 'ご報告を確認しました' end;
  v_body=case v_public_status when 'resolved' then '修正内容は更新情報をご確認ください。' when 'closed' then '内容を確認し、今回の対応を終了しました。' when 'in_progress' then '再現確認と修正内容の検証を進めています。' else '内容を分類し、対応方法を確認しています。' end;
  insert into public.cloud_ai_notifications(audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key)
  select 'user',feedback.owner_profile_id,'monitor_report_status','info',v_title,v_body,feedback.id::text,
    'monitor:task:'||new.id||':'||new.status||':'||feedback.id
  from public.cloud_general_monitor_feedback feedback
  where feedback.triage_fingerprint=new.fingerprint
  on conflict(dedupe_key) do nothing;
  return new;
end $$;
revoke all on function public.sync_cloud_monitor_issue_public_status() from public,anon,authenticated;

drop trigger if exists cloud_monitor_issue_public_status on public.cloud_monitor_issue_tasks;
create trigger cloud_monitor_issue_public_status after update of status on public.cloud_monitor_issue_tasks
for each row execute function public.sync_cloud_monitor_issue_public_status();

create or replace function public.review_cloud_general_monitor_feedback(
  p_actor_profile_id uuid,p_feedback_id uuid,p_status text,p_admin_note text
) returns void language plpgsql security definer set search_path=public as $$
declare v_owner uuid;v_public_status text;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_profile_id and role='admin') then raise exception 'cloud_general_monitor_admin_required';end if;
  if p_status not in('new','reviewing','resolved') or char_length(coalesce(p_admin_note,''))>1000 then raise exception 'cloud_general_monitor_input_invalid';end if;
  v_public_status=case p_status when 'new' then 'submitted' when 'reviewing' then 'in_progress' else 'resolved' end;
  update public.cloud_general_monitor_feedback set review_status=p_status,public_status=v_public_status,status_updated_at=now(),admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now() where id=p_feedback_id returning owner_profile_id into v_owner;
  if not found then raise exception 'cloud_general_monitor_feedback_not_found';end if;
  insert into public.cloud_ai_notifications(audience,profile_id,notification_type,severity,title,body,source_id,dedupe_key)
  values('user',v_owner,'monitor_report_status','info',case p_status when 'resolved' then 'ご報告への対応が完了しました' when 'reviewing' then 'ご報告を確認しています' else 'ご報告を受け付けています' end,case p_status when 'resolved' then 'ご協力ありがとうございました。更新情報もご確認ください。' when 'reviewing' then '内容を確認し、必要な対応を進めています。' else '内容を受け付けました。' end,p_feedback_id::text,'monitor:review:'||p_feedback_id||':'||p_status)
  on conflict(dedupe_key) do nothing;
end $$;
revoke all on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_cloud_general_monitor_feedback(uuid,uuid,text,text) to service_role;

commit;
