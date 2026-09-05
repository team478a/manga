begin;

alter table public.cloud_general_monitor_email_settings
  alter column subject_template set default
    'MANGAI 先行販売購入者向け先行利用のご案内',
  alter column body_template set default
    $template${{recipient_name}}

MANGAIを先行販売でご購入いただいたお客様への先行利用をご案内します。
これは無料参加をお願いする一般的なモニター募集ではありません。正式リリース前の機能を段階的にご利用いただき、ご意見を伺う購入者向け先行提供です。
先行利用中も購入者としての権利や、正式リリース後の利用資格は失われません。

登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

このメールへパスワード、APIキー、個人情報を返信しないでください。$template$;

update public.cloud_general_monitor_email_settings
set subject_template='MANGAI 先行販売購入者向け先行利用のご案内',
    body_template=$template${{recipient_name}}

MANGAIを先行販売でご購入いただいたお客様への先行利用をご案内します。
これは無料参加をお願いする一般的なモニター募集ではありません。正式リリース前の機能を段階的にご利用いただき、ご意見を伺う購入者向け先行提供です。
先行利用中も購入者としての権利や、正式リリース後の利用資格は失われません。

登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

このメールへパスワード、APIキー、個人情報を返信しないでください。$template$
where singleton=true
  and subject_template='MANGAI 一般向けモニターのご案内'
  and body_template=$template${{recipient_name}}

MANGAI一般向けモニターへご招待しました。
登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: {{welcome_url}}
利用期限: {{expires_on}}
AI利用上限: {{ai_request_limit}}回

このメールへパスワード、APIキー、個人情報を返信しないでください。$template$;

commit;
