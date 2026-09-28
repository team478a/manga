# Marketplace Production canary bundle事前検証

作成日: 2026-09-28
対象: 一般向けMarketplace Production 1件canary
状態: offline gate実装済み／live販売無効

## 目的

repository外の承認計画とProduction候補envを個別に検証した後、両者の対象が完全一致することをProduction接続前に確認する。個別には正しい別商品・別参加者・別期限・別fingerprintの組み合わせを誤って適用する事故を防ぐ。

## コマンド

```powershell
npm run marketplace:production:canary-bundle:validate -- "C:\secure\marketplace-canary.json" "C:\secure\marketplace-production.env"
```

両ファイルは絶対pathかつrepository外に保存する。Git、Issue、PR、チャットへ内容を貼らない。

## READY条件

- 計画が1商品、異なる売り手／買い手、1回、50〜1,000円、最大24時間、返金fallbackありの固定schemaである。
- 候補envがProduction Supabase、正規origin、live checkout、Stripe live資格情報、single-target canary gateを満たす。
- 候補envの商品、売り手、買い手、期限、fingerprintが計画と完全一致する。

## 安全境界

- offline検証だけで、Vercel、Supabase、Stripeへ接続しない。
- 環境変数を追加・更新しない。
- 商品、作品、注文、決済、返金を変更しない。
- 計画ID、Supabase資格情報、Stripe key、Webhook secret、Cancel secretを出力しない。
- READYでもProduction設定適用や購入の承認にはならない。

## 検証

- 集中テスト: 32/32成功
- Hub: 1102/1102成功
- dependency boundaries: error 0、既知warning 2件
- lint: 成功
- Hub／Desktop typecheck: 成功
- packages／Next.js Webpack Production build: 成功
- migration validator: 88/88成功
- RC Repository structure: READY
- `git diff --check`: 成功
- 商品、売り手、買い手、期限、fingerprintの各不一致を拒否
- 不正計画と不完全候補envを拒否
- reportへの内部ID・秘密値非混入を確認

Production、Vercel環境変数、Supabase、Stripe、商品、作品、注文、決済、返金、Provider、生成Job、credit、利用者データは変更していない。
