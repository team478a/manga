# 成人向け限定モニター運用手順

> 2026-07-31更新: 招待メール、初回案内、Webマニュアル、公開前チェック、
> フィードバック対応管理は
> [`CLOUD_ADULT_MONITOR_OPERATIONS_V1.md`](./CLOUD_ADULT_MONITOR_OPERATIONS_V1.md)
> を正として運用します。

## 公開範囲

対象は管理者が選んだ既存購入者など1〜3名です。Vercel Previewだけで実施し、本番公開、一般募集、成人向け画像生成、Marketplace、販売は行いません。

## 公開前

1. migration `202607300011_cloud_adult_workflow_bulk_grant.sql` を適用する。
2. migration `202607300012_cloud_adult_monitor_beta.sql` を適用する。
3. `npm run cloud:adult-monitor:preflight` を実行する。
4. Preview環境だけで必要なFeature Flagを`true`にする。
5. 管理者画面の「限定モニター」で対象者、期限、AI利用上限を設定する。
6. 対象者本人が各成人向け規約へ同意する。

## モニターへ渡すもの

- Vercel Shareable Link
- 登録済みメールアドレス
- 利用期限
- AI利用上限
- `/dashboard/adult-monitor` のフィードバック案内
- 成人向け画像生成、公開、販売は対象外である旨

## 完走確認

ログイン、市場分析、AI企画、シナリオ、ネーム、Canvas下書き、作品管理からの書き出し、フィードバック送信を順番に確認します。

## 緊急停止

全体停止は最初にPreviewの`CLOUD_ADULT_MONITOR_BETA_ENABLED=false`へ変更してRedeployします。個人停止は管理者のユーザー詳細から「モニターと全工程を停止」を実行します。DB側の機能別Kill Switchも停止できます。

ログや問い合わせにはAPIキー、入力本文、生成本文、成人向け具体内容を記録しません。
