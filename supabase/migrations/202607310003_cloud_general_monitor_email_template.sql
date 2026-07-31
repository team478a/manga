begin;

alter table public.cloud_general_monitor_email_settings
  add column if not exists subject_template text;
alter table public.cloud_general_monitor_email_settings
  add column if not exists body_template text;

update public.cloud_general_monitor_email_settings
set subject_template=coalesce(
      subject_template,
      'MANGAI 一般向けモニターのご案内'
    ),
    body_template=coalesce(
      body_template,
      $template${{recipient_name}}

MANGAI一般向けモニターへご招待しました。
登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

このメールへパスワード、APIキー、個人情報を返信しないでください。$template$
    )
where singleton=true;

alter table public.cloud_general_monitor_email_settings
  alter column subject_template set default
    'MANGAI 一般向けモニターのご案内',
  alter column subject_template set not null,
  alter column body_template set default
    $template${{recipient_name}}

MANGAI一般向けモニターへご招待しました。
登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

このメールへパスワード、APIキー、個人情報を返信しないでください。$template$,
  alter column body_template set not null;

alter table public.cloud_general_monitor_email_settings
  drop constraint if exists cloud_general_monitor_email_subject_template_check,
  drop constraint if exists cloud_general_monitor_email_body_template_check;
alter table public.cloud_general_monitor_email_settings
  add constraint cloud_general_monitor_email_subject_template_check
    check (
      char_length(subject_template) between 1 and 120
      and subject_template!~E'[\\r\\n]'
    ),
  add constraint cloud_general_monitor_email_body_template_check
    check (
      char_length(body_template) between 20 and 5000
      and position('{{welcome_url}}' in body_template)>0
    );

alter table public.cloud_general_monitor_email_audit_logs
  drop constraint if exists cloud_general_monitor_email_audit_logs_action_check;
alter table public.cloud_general_monitor_email_audit_logs
  add constraint cloud_general_monitor_email_audit_logs_action_check
    check (action in ('configure','replace_key','update_template'));

create or replace function public.set_cloud_general_monitor_email_template(
  p_actor_profile_id uuid,
  p_subject_template text,
  p_body_template text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_subject text:=btrim(coalesce(p_subject_template,''));
  v_body text:=btrim(coalesce(p_body_template,''));
  v_unknown_tokens text;
  v_from_email text;
begin
  if auth.role()<>'service_role' or not exists (
    select 1 from public.profiles
    where id=p_actor_profile_id and role='admin'
  ) then
    raise exception 'cloud_general_monitor_email_admin_required';
  end if;

  v_unknown_tokens:=regexp_replace(
    v_subject||E'\n'||v_body,
    '\{\{(recipient_name|welcome_url|expires_on|ai_request_limit)\}\}',
    '',
    'g'
  );
  if char_length(v_subject) not between 1 and 120
    or v_subject~E'[\\r\\n]'
    or char_length(v_body) not between 20 and 5000
    or position('{{welcome_url}}' in v_body)=0
    or v_unknown_tokens~'\{\{[a-z_]+\}\}'
  then
    raise exception 'cloud_general_monitor_email_template_invalid';
  end if;

  update public.cloud_general_monitor_email_settings
  set subject_template=v_subject,
      body_template=v_body,
      updated_by_profile_id=p_actor_profile_id,
      updated_at=now()
  where singleton=true
  returning from_email into v_from_email;

  insert into public.cloud_general_monitor_email_audit_logs(
    actor_profile_id,action,from_email
  ) values(
    p_actor_profile_id,
    'update_template',
    coalesce(v_from_email,'')
  );
end
$$;

revoke all on function public.set_cloud_general_monitor_email_template(
  uuid,text,text
) from public,anon,authenticated;
grant execute on function public.set_cloud_general_monitor_email_template(
  uuid,text,text
) to service_role;

commit;
