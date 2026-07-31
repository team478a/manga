# 一般向け限定モニター運用手順

## 1. Preview準備

1. 対象ブランチをVercel Previewへデプロイする。
2. migrationを次の順でPreview用Supabaseへ適用する。
   - `202607300006_cloud_general_monitor_beta.sql`
   - `202607310001_cloud_general_monitor_operations.sql`
   - `202607310002_cloud_general_monitor_email_provider.sql`
3. 一般向けFeature Flagと `CLOUD_GENERAL_MONITOR_BETA_ENABLED=true` を対象Previewブランチだけに設定する。
4. `CLOUD_ADULT_RESEARCH_ENABLED=false`、`CLOUD_ADULT_PLANNING_ENABLED=false` を確認する。
5. `npm run cloud:general-monitor:preflight` を実行する。出力に値は表示されない。
6. `/admin/general-monitors/readiness`を開き、全項目が「準備完了」になることを確認する。

招待メールは、migration適用後に`/admin/general-monitors/email`で次を設定する。

- Resend APIキー
- Resendで認証済みの送信元メールアドレス
- 送信者名

APIキーはSupabase Vaultへ暗号化保存され、画面、通常テーブル、監査ログには
再表示されない。変更時も同じ画面へ新しいキーを入力して保存する。
対象PreviewのHTTPS originだけは`MONITOR_INVITE_SITE_URL`へ設定する。

順序は必ず migration → Feature Flag → 招待とする。Feature Flagが停止中は、
管理画面もモニター用テーブルを参照せず、招待・停止操作を受け付けない。

## 2. 招待

約10名を同一コホートとして管理する。例:
`general-monitor-2026-08`。期限とAI上限は原則として全員で統一し、
個別に変更した場合は管理メモへ理由を残す。

一斉招待は行わず、スタッフ1名 → 2〜3名 → 残りの順に段階公開する。
各段階でメール受信、ログイン、市場分析の保存、未対応フィードバックを確認してから
次の対象者を招待する。

1. `/admin/users` から対象ユーザーを選ぶ。
2. 一般向けモニター欄でグループ、AI上限、期限を入力する。
3. 「モニターへ招待」を押す。
4. 招待登録が成功すると、登録済みメールアドレスへ自動送信される。
5. 送信失敗時は設定を確認し、「招待メールを再送」を押す。
6. 本人は初回ログイン後に利用条件を確認してモニターを開始する。

スタッフは`/admin/general-monitors/guide`、利用者は
`/dashboard/monitor/guide`をWebマニュアルとして使用する。

## 3. 確認

- `/admin/general-monitors` で状態、AI利用数、期限を確認する。
- 未確認の初回案内、期限、残りAI回数を確認する。
- 利用者は `/dashboard/monitor` から感想を送る。
- フィードバックを未対応・対応中・対応済みに更新し、必要なら管理メモを残す。
- 「CSV出力」で週次の利用状況を保存する。
- 内部エラー、APIキー、Prompt、生成内容をログや連絡文へ貼らない。

## 4. 緊急停止

ユーザー詳細で「一時停止」または「招待取消」を実行する。全体停止は
`CLOUD_GENERAL_MONITOR_BETA_ENABLED=false` に変更して再デプロイする。

Stripe設定、販売設定、成人向け設定は変更しない。
Resendの送信履歴でも受付状態を確認する。API keyやProvider応答本文を問い合わせ文へ貼らない。
