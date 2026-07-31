begin;

alter table public.cloud_adult_monitor_enrollments
  add column if not exists onboarding_completed_at timestamptz;

alter table public.cloud_adult_monitor_feedback
  add column if not exists review_status text not null default 'new'
    check(review_status in('new','reviewing','resolved')),
  add column if not exists admin_note text
    check(admin_note is null or char_length(admin_note)<=1000),
  add column if not exists reviewed_by_profile_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists cloud_adult_monitor_feedback_review_idx
  on public.cloud_adult_monitor_feedback(review_status,created_at desc);

alter table public.cloud_general_monitor_email_settings
  add column if not exists adult_subject_template text not null default
    'MANGAI 成人向け限定モニターのご案内',
  add column if not exists adult_body_template text not null default
    $template${{recipient_name}}

MANGAI成人向け限定モニターへご招待しました。
18歳以上の確認、利用条件への同意後、市場分析から非公開作品管理までお試しいただけます。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

成人向け画像生成、公開、販売は今回のモニター対象外です。
このメールへパスワード、APIキー、個人情報を返信しないでください。$template$;

alter table public.cloud_general_monitor_email_settings
  drop constraint if exists cloud_adult_monitor_email_subject_template_check,
  drop constraint if exists cloud_adult_monitor_email_body_template_check;
alter table public.cloud_general_monitor_email_settings
  add constraint cloud_adult_monitor_email_subject_template_check
    check(char_length(adult_subject_template) between 1 and 120 and adult_subject_template!~E'[\r\n]'),
  add constraint cloud_adult_monitor_email_body_template_check
    check(char_length(adult_body_template) between 20 and 5000 and position('{{welcome_url}}' in adult_body_template)>0);

alter table public.cloud_general_monitor_email_audit_logs
  drop constraint if exists cloud_general_monitor_email_audit_logs_action_check;
alter table public.cloud_general_monitor_email_audit_logs
  add constraint cloud_general_monitor_email_audit_logs_action_check
    check(action in('configure','replace_key','update_template','update_adult_template'));

create or replace function public.complete_cloud_adult_monitor_onboarding()
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.cloud_adult_monitor_enrollments
  set onboarding_completed_at=coalesce(onboarding_completed_at,now()),updated_at=now()
  where profile_id=public.current_profile_id() and status='active'
    and starts_at<=now() and expires_at>now();
  if not found then raise exception 'cloud_adult_monitor_unavailable';end if;
end;$$;

create or replace function public.review_cloud_adult_monitor_feedback(
  p_actor_profile_id uuid,p_feedback_id uuid,p_status text,p_admin_note text
) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.profiles where id=p_actor_profile_id and role='admin'
  ) then raise exception 'cloud_adult_monitor_admin_required';end if;
  if p_status not in('new','reviewing','resolved') or char_length(coalesce(p_admin_note,''))>1000
    then raise exception 'cloud_adult_monitor_input_invalid';end if;
  update public.cloud_adult_monitor_feedback
  set review_status=p_status,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),
      reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now()
  where id=p_feedback_id;
  if not found then raise exception 'cloud_adult_monitor_feedback_not_found';end if;
end;$$;

create or replace function public.set_cloud_adult_monitor_email_template(
  p_actor_profile_id uuid,p_subject_template text,p_body_template text
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_subject text:=btrim(coalesce(p_subject_template,''));
  v_body text:=btrim(coalesce(p_body_template,''));
  v_unknown_tokens text;
  v_from_email text;
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.profiles where id=p_actor_profile_id and role='admin'
  ) then raise exception 'cloud_general_monitor_email_admin_required';end if;
  v_unknown_tokens:=regexp_replace(
    v_subject||E'\n'||v_body,
    '\{\{(recipient_name|welcome_url|expires_on|ai_request_limit)\}\}','','g'
  );
  if char_length(v_subject) not between 1 and 120 or v_subject~E'[\r\n]'
    or char_length(v_body) not between 20 and 5000
    or position('{{welcome_url}}' in v_body)=0
    or v_unknown_tokens~'\{\{[a-z_]+\}\}'
  then raise exception 'cloud_adult_monitor_email_template_invalid';end if;
  update public.cloud_general_monitor_email_settings
  set adult_subject_template=v_subject,adult_body_template=v_body,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
  where singleton=true returning from_email into v_from_email;
  insert into public.cloud_general_monitor_email_audit_logs(actor_profile_id,action,from_email)
  values(p_actor_profile_id,'update_adult_template',coalesce(v_from_email,''));
end;$$;

revoke all on function public.complete_cloud_adult_monitor_onboarding() from public,anon;
revoke all on function public.review_cloud_adult_monitor_feedback(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.set_cloud_adult_monitor_email_template(uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_cloud_adult_monitor_onboarding() to authenticated,service_role;
grant execute on function public.review_cloud_adult_monitor_feedback(uuid,uuid,text,text) to service_role;
grant execute on function public.set_cloud_adult_monitor_email_template(uuid,text,text) to service_role;

commit;
