# Marketplace Production migration適用証跡

作成日: 2026-09-28
対象: 一般向けMarketplace Production canary準備
状態: 適用済み／postflight成功／live販売無効

## 対象

- Supabase project表示: `mangai-hub-staging`
- Branch表示: `main`
- 環境表示: `PRODUCTION`
- Base: PR #541 merge commit `25d9a4d0`

Production環境は表示名に`staging`を含むが、画面上のBranchと環境badgeを含めてProduction対象であることを確認した。別Project、Preview Branch、`mailsend`は操作していない。

## 承認と停止境界

当初のread-only preflightでは次を確認した。

- `buyer_profile_id`: 存在
- `payment_mode`: 不在
- `stripe_payment_intent_id`: 存在
- `orders_live_single_purchase_idx`: 不在

`202609280002`だけでは成立しないため、DB変更を行わず停止した。責任者が`202609270001`と`202609280002`をこの順でProductionへ適用することを明示承認した後に再開した。

## 適用順序

1. `202609270001_marketplace_test_sales.sql`
   - SHA-256: `A7F2BB799C4C6433AAD4B5DBAB683348297574375DDE37C2480B5F339D381E6D`
   - `orders.payment_mode`をNOT NULL／default `live`で追加
   - `test`／`live` check constraintを追加
   - `orders_payment_mode_status_idx`を追加
2. `202609280002_marketplace_live_single_purchase.sql`
   - SHA-256: `8974EF309C434518BCF9EC664E90FFBF0B4F9FBF100860BC9C2428A151473B73`
   - 既存live重複をtransaction内で拒否
   - `orders_live_single_purchase_idx`を追加

各migrationは原本を1回ずつ実行し、Supabase SQL Editorの`Success. No rows returned`を確認した。

## Postflight

### 1件目

- `payment_mode`列: 存在
- `orders_payment_mode_check`: 存在
- `orders_payment_mode_status_idx`: 存在
- 不正またはNULLの`payment_mode`: 0件
- 注文総数: 0件
- live注文: 0件
- 同一商品・購入者のlive `pending`／`paid`重複group: 0件

### 2件目

- `orders_live_single_purchase_idx`: 存在
- index種別: UNIQUE
- key: `product_id, buyer_profile_id`
- predicate: `payment_mode = live`、`buyer_profile_id is not null`、statusが`pending`または`paid`
- 同一商品・購入者のlive `pending`／`paid`重複group: 0件
- 不正またはNULLの`payment_mode`: 0件

## 変更していないもの

- Vercel Production環境変数
- Marketplace checkout mode
- Stripe live Secret／Webhook／Payment Intent
- 商品、作品、注文、決済、返金、download
- Cloud AI Provider、生成Job、Asset、credit
- 利用者profile、Auth、Storage

Repository検証はmigration validator 88/88、RC Repository structure、`git diff --check`が成功した。Draft PR [#542](https://github.com/team478a/manga/pull/542)の初回HEAD `64f8fb81`はCore quality、Migration roundtrip、Windows build、Vercel、Preview Commentsがすべて成功した。RC preflightの外部設定と手動E2Eは資格情報を注入していないため既知のPENDINGを維持する。

この適用だけではlive販売は開始しない。次の工程はProduction限定canary env候補、承認済み計画、GET-only対象preflightであり、設定適用と1件購入はそれぞれ別の明示承認単位とする。
