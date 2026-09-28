# Marketplace Production canary環境準備監査

作成日: 2026-09-28
対象: 一般向けMarketplace Production canary設定前監査
状態: read-only監査完了／live販売無効

## 目的

Production migration適用後、Vercel Production環境の設定状況を値なしで確認し、canary販売を有効化する前に不足項目を確定する。環境変数、Stripe、Supabase、商品、注文は変更しない。

## 実行したread-only確認

```powershell
npm run marketplace:production:preflight
vercel.cmd env run -e production -- npm.cmd run marketplace:production:preflight:injected
vercel.cmd env ls production --format json --no-color
```

preflightは環境値を表示しない。metadata確認もキー名、型、scopeだけに限定し、値を出力しなかった。

## Production限定で存在する項目

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `CHECKOUT_CANCEL_SECRET`

Supabase 3資格情報とCancel SecretはSensitive、site URLは暗号化済みProduction scopeである。Sensitive値はCLIへ返らないため、Supabase identityの値照合はPENDINGを維持する。

## 未設定項目

- `MANGAI_MARKETPLACE_CHECKOUT_MODE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MANGAI_MARKETPLACE_LIVE_ACCESS`
- `MANGAI_MARKETPLACE_CANARY_PRODUCT_ID`
- `MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID`
- `MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID`
- `MANGAI_MARKETPLACE_CANARY_EXPIRES_AT`
- `MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT`

Stripeとcanary targetの値は未確定であり、推測して設定しない。商品、売り手、買い手、50〜1,000円の価格、最大24時間の期限、返金fallbackを含むrepository外計画が先に必要である。

## 診断改善

従来のscope preflightは、不足時に「Productionだけへ設定する」とだけ表示していた。現在は不足キーごとに必要な`Production-only`／`Sensitive`属性を表示する。値、内部ID、Project ref、secretをreportへ含めない。

## 現在の判定

- Production checkout origin: READY
- Production-only Vercel scope: PENDING
- Production Supabase identity: PENDING
- Marketplace live checkout mode: PENDING
- Single-target live canary gate: PENDING
- Stripe live credentials: PENDING

## Repository検証

- focused: 10/10
- Hub: 1098/1098
- dependency boundaries: error 0、既知warning 2件
- lint: 成功
- Hub／Desktop typecheck: 成功
- packages／Next.js Webpack Production build: 成功
- migration validator: 88/88
- RC Repository structure: READY
- `git diff --check`: 成功

## 次の承認境界

1. Stripe liveアカウント、Webhook、入金先、法務・税務・返金運用を確定する。
2. canary商品、売り手、買い手、金額を確定する。
3. repository外計画を作成してfingerprintを検証する。
4. Production候補envをrepository外で検証する。
5. 対象と全キーを固定した明示承認後だけVercel Productionへ設定する。
6. GET-only対象preflight成功後、別承認で1件購入する。

本監査ではVercel環境、Supabase、Stripe、商品、作品、注文、決済、返金、Provider、生成Job、credit、利用者データを変更していない。
