# 一般向け限定モニター運用手順

## 1. Preview準備

1. 対象ブランチをVercel Previewへデプロイする。
2. migration `202607300006_cloud_general_monitor_beta.sql` をPreview用Supabaseへ適用する。
3. 一般向けFeature Flagと `CLOUD_GENERAL_MONITOR_BETA_ENABLED=true` を対象Previewブランチだけに設定する。
4. `CLOUD_ADULT_RESEARCH_ENABLED=false`、`CLOUD_ADULT_PLANNING_ENABLED=false` を確認する。
5. `npm run cloud:general-monitor:preflight` を実行する。出力に値は表示されない。

順序は必ず migration → Feature Flag → 招待とする。Feature Flagが停止中は、
管理画面もモニター用テーブルを参照せず、招待・停止操作を受け付けない。

## 2. 招待

1. `/admin/users` から対象ユーザーを選ぶ。
2. 一般向けモニター欄でグループ、AI上限、期限を入力する。
3. 「モニターへ招待」を押す。
4. PreviewのShareable Linkとテスト手順だけを本人へ案内する。

## 3. 確認

- `/admin/general-monitors` で状態、AI利用数、期限を確認する。
- 利用者は `/dashboard/monitor` から感想を送る。
- 内部エラー、APIキー、Prompt、生成内容をログや連絡文へ貼らない。

## 4. 緊急停止

ユーザー詳細で「一時停止」または「招待取消」を実行する。全体停止は
`CLOUD_GENERAL_MONITOR_BETA_ENABLED=false` に変更して再デプロイする。

Stripe設定、販売設定、成人向け設定は変更しない。
