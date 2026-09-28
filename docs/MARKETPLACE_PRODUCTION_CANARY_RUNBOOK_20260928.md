# Marketplace Production 1件canary販売ランブック

作成日: 2026-09-28
対象: 一般向けMarketplaceのProduction限定販売
状態: Production migration適用済み。live販売は未有効化

## 目的

Production販売を全面公開する前に、対象を1商品・購入者1名・購入1回・少額へ固定し、承認された計画と実行内容が一致することを確認する。計画検証、設定変更、購入、返金はそれぞれ別工程として扱い、暗黙に次へ進めない。

成人向けDesktop、Cloud AI Provider、生成Job、creditは対象外とする。

## 開始前に責任者が確定する事項

- Stripe liveアカウント、入金先、本人確認・事業情報が利用可能であること。
- 特定商取引法に基づく表示、利用規約、プライバシーポリシー、返金方針、問い合わせ先、税務運用の内容と公開場所。
- canary対象の商品、売り手、購入者、販売価格。
- 購入者が実決済と、受入れ失敗時の全額返金に同意していること。

このリポジトリは法務・税務判断を代替しない。内容が未確定ならProduction販売を開始しない。

## 計画ファイル

計画はrepository外の絶対pathにJSONで保存する。氏名、メールアドレス、API key、Webhook secret、カード情報、住所、自由記述を含めない。

```json
{
  "schemaVersion": 1,
  "purpose": "marketplace-production-canary",
  "environment": "production",
  "productionOrigin": "https://app.mang-ai.com",
  "checkoutMode": "live",
  "productId": "11111111-1111-4111-8111-111111111111",
  "sellerProfileId": "22222222-2222-4222-8222-222222222222",
  "buyerProfileId": "33333333-3333-4333-8333-333333333333",
  "currency": "jpy",
  "expectedAmountJpy": 100,
  "maxPurchaseCount": 1,
  "refundOnAcceptanceFailure": true,
  "createdAt": "2026-09-28T03:00:00.000Z",
  "expiresAt": "2026-09-28T15:00:00.000Z"
}
```

UUIDと時刻は実行対象へ置き換える。`expiresAt`は`createdAt`から24時間以内かつ検証時点より後でなければならない。

```powershell
npm run marketplace:production:canary-plan:validate -- "C:\secure\marketplace-canary.json"
```

検証器は計画値を出力せず、合格時だけSHA-256 fingerprintを表示する。計画を1文字でも変更するとfingerprintが変わる。責任者の実行承認は、このfingerprint、金額、購入回数1回を明示して記録する。

## 実行段階

### 1. 外部判断とProduction状態のread-only確認

1. 法務・税務・Stripe運用の確定を記録する。
2. Production migrationは適用済み。`payment_mode`境界とlive重複購入防止indexのpostflightも成功した。
3. Stripe live webhook endpointが正規Production URLだけを向き、必要eventだけを購読していることをread-onlyで確認する。
4. 商品が対象売り手所有、販売可能、JPY価格が計画と一致し、downloadファイルが存在することをread-onlyで確認する。
5. 購入者と売り手が異なることを確認する。

1項目でも不一致なら停止する。

Production環境をprocessへ一時注入し、計画と商品・作品・参加者・既存注文をGETだけで照合する。checkout modeがまだ`disabled`でも対象照合はできるが、`test`はProduction取り違えとして拒否する。

```powershell
vercel.cmd env run -e production -- npm.cmd run marketplace:production:canary-target:preflight -- "C:\secure\marketplace-canary.json"
```

このpreflightは氏名、メール、Payment Intent、販売ファイル本体を取得しない。商品は計画の売り手所有・販売中・計画額・file pathあり、作品は一般向け・公開・published・Cloud由来なら完成版固定済み、参加者は2名とも存在、同じ組み合わせの`pending`／`paid` live注文は0件であることを必須にする。結果へ内部ID、file path、秘密値を出力しない。

### 2. Production設定候補の検証

repository外の候補envを既存preflightへ通す。

```powershell
npm run marketplace:production:candidate:validate -- "C:\secure\marketplace-production.env"
```

6項目すべてが`READY`になるまでVercel Productionへ設定しない。候補検証だけでは環境変数を変更しない。`live`設定にはStripe資格情報に加えて次のserver-only canary gateを含め、すべてProduction限定かつ内部ID・期限・fingerprintはSensitiveとして保存する。

```env
MANGAI_MARKETPLACE_LIVE_ACCESS=canary
MANGAI_MARKETPLACE_CANARY_PRODUCT_ID=<plan.productId>
MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID=<plan.sellerProfileId>
MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID=<plan.buyerProfileId>
MANGAI_MARKETPLACE_CANARY_EXPIRES_AT=<plan.expiresAt>
MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT=<validator fingerprint>
```

個別検証後、同じ計画JSONと候補envをbundle gateへ渡す。商品、売り手、買い手、期限、fingerprintが1項目でも計画と違えば、Productionへ接続する前に停止する。

```powershell
npm run marketplace:production:canary-bundle:validate -- "C:\secure\marketplace-canary.json" "C:\secure\marketplace-production.env"
```

bundle gateはofflineであり、Vercel、Supabase、Stripeへ接続しない。計画ID、環境値、秘密値は出力しない。

### 3. 設定適用

責任者が対象変数と適用先を明示承認した後だけ、Production限定scopeへ設定する。Preview／Developmentへlive資格情報を共有しない。設定後にDeploymentを作成し、注入済みprocessでstrict preflightを再実行する。

```powershell
vercel.cmd env run -e production -- npm.cmd run marketplace:production:preflight:injected -- --strict
```

strictが失敗した場合は購入へ進まない。

設定後のtarget preflightでは、runtime gateの3 ID、期限、fingerprintがrepository外計画と完全一致することも確認する。不一致時は商品状態にかかわらず停止する。

### 4. 1件canary購入

1. 承認fingerprintと計画ファイルが一致し、有効期限内であることを再検証する。
2. 対象商品だけを限定公開する。
3. 指定購入者が正規Production URLから1回だけ購入する。
4. Stripe Checkoutで表示された通貨・金額・商品名を確定前に照合する。
5. 計画額を超える、別商品になる、2件目の注文が存在する場合は確定せず停止する。

アプリは公開画面、購入画面、仮注文作成前、Stripe Session作成直前の各段階で同じcanary対象を検査する。本番`pending`／`paid`は同一購入者・商品につきDBで1件に制限し、同一注文のStripe Sessionは注文ID由来のidempotency keyで重複作成を防ぐ。

### 5. 購入後の受入れ

- Stripe liveの決済成功は対象1件だけである。
- Production注文は`payment_mode=live`、`paid`、対象商品・売り手・購入者・金額が一致する。
- 購入履歴へ1件だけ表示される。
- 5分署名URLで対象ファイルを取得でき、別利用者からは取得できない。
- 売上画面の件数・売上・受取予定額が対象1件分だけ増える。
- Webhookエラー、重複注文、内部IDや秘密値の露出がない。

受入れ失敗時は新規販売を即時停止し、計画どおり対象決済を全額返金する。返金実行も対象注文と金額を固定した別の明示承認を必要とする。

## 停止・復旧順序

1. Marketplace checkout modeを`disabled`へ戻す。
2. 対象商品の販売状態を停止する。
3. Production deploymentとWebhook配送状況を確認する。
4. 新規注文が増えていないことをread-onlyで確認する。
5. 必要な場合だけ、対象注文の全額返金を別承認後に行う。

途中で失敗しても注文行、Stripe event、監査証跡を削除しない。秘密値を文書・Issue・PR・ログへ貼らない。

## 現在位置

- 隔離Stagingの成功、失敗、全額返金、認可、署名URL失効は完了。
- Production readiness preflightは実装済み。
- Production canary対象のGET-only preflightは実装済み。実計画が未確定のため外部実行は未実施。
- 1商品・売り手・買い手・期限・承認fingerprintを強制するruntime canary gateは実装済み。本番重複購入防止migrationと前提の`payment_mode` migrationはProductionへ適用済みで、環境設定は未実施。
- Productionは正規originだけREADYで、live modeとStripe live資格情報は未設定。
- canary計画検証器は外部接続しない。対象preflightはProductionへGETだけを行い、どちらも設定・商品・注文・決済を変更しない。
