# Marketplace隔離Staging 静的seed／Storage復旧

日付: 2026-09-28

対象: Supabase Preview Branch `marketplace-staging`

状態: `STAGING_REPAIRED / PRODUCTION_UNCHANGED / PURCHASE_E2E_PENDING`

## 発見した問題

隔離Stagingでseller／buyerのAuth userを作成した後、次の2段階で欠落を確認した。

1. `cloud_ai_plans`と`cloud_ai_settings`の静的行がなく、profile作成時のCloud AI entitlement付与が外部キー違反になった。
2. sellerが一般作品を保存すると、`works` bucketとStorage policyがないため「ファイルをStorageへ保存できませんでした。」で停止した。

Supabase Preview Branchにはpublic schemaが複製されていた一方、静的なtable row、Storage bucket、`storage.objects` policyは複製されていなかった。Productionの欠落や利用者データの破損ではない。

## 修正

`202609280001_marketplace_static_seed`を追加した。次を冪等に復元する。

- `free`／`trial`／`creator`のCloud AI plan
- singletonのCloud AI settings
- 公開`works` bucket（10MB、JPEG／PNG／WebP）
- 非公開`digital-products` bucket（50MB、PDF／PNG／JPEG／ZIP）
- 作品公開読取と、両bucketの所有者限定upload／update／delete policy

既存planの料金・credit、既存bucket object、利用者rowは上書きまたは削除しない。rollbackも共有seedや販売ファイルを暗黙削除しない。

Migration roundtripへ、静的row／bucket／policyを意図的に欠落させてから本migrationだけで復元する回帰試験を追加した。

## 検証

- Hub test: 1045/1045
- isolated Staging strict preflight: 3/3 READY
- dependency check: error 0（既知warning 2件）
- lint: 成功
- Hub／Desktop typecheck: 成功
- migration manifest: 87/87
- Hub Production build: 成功
- `git diff --check`: 成功
- RC preflight: repository structureはREADY。外部資格情報と手動E2Eはローカル環境ではPENDING（想定どおり）

## 隔離Staging適用結果

責任者の実行時承認後、Supabase CLIの対象Project refをBranch一覧と照合し、親ProductionではなくPreview Branchへmigration原本を1回適用した。

- plan: 3件
- settings: 1件
- bucket: 2件
- Storage policy: 7件
- synthetic Auth user: 2件
- synthetic profile: 2件
- synthetic work: 0件
- Marketplace Storage object: 0件
- order: 0件

作品保存の最初の試行はbucket復旧前に失敗しており、部分的な作品rowやobject、注文は残っていない。

## 安全境界

- Production DB／Storage／環境変数は未変更。
- Provider実行、生成Job、credit予約・消費は0件。
- Stripe決済、テスト注文、実注文は0件。
- 実カード、実売上、実利用者データは使用していない。
- Preview Branch computeの削除は別の実行時確認まで行わない。

## 残件

1. Chrome連携を復旧し、同じsellerで公開作品と販売中商品を保存する。
2. buyerで公式StripeテストCheckoutを開く。
3. 最終のテスト決済実行直前に、金融操作として責任者へ再確認する。
4. 成功後に`payment_mode=test`、購入履歴、5分署名download、本番売上除外を確認する。
5. 失敗／返金／別利用者download拒否を確認する。
