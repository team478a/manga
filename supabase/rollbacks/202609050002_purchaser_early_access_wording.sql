begin;

alter table public.cloud_general_monitor_email_settings
  alter column subject_template set default
    'MANGAI 一般向けモニターのご案内',
  alter column body_template set default
    $template${{recipient_name}}

MANGAI一般向けモニターへご招待しました。
登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

このメールへパスワード、APIキー、個人情報を返信しないでください。$template$;

update public.cloud_general_monitor_email_settings
set subject_template='MANGAI 一般向けモニターのご案内',
    body_template=$template${{recipient_name}}

MANGAI一般向けモニターへご招待しました。
登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

このメールへパスワード、APIキー、個人情報を返信しないでください。$template$
where singleton=true
  and subject_template='MANGAI 先行販売購入者向け先行利用のご案内';

commit;
