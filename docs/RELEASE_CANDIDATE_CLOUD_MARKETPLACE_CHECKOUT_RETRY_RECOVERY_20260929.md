# Cloud限定販売 Checkout再試行回復 RC記録（2026-09-29）

## 結論

Stripe Checkout Session作成時の通信断などで結果が曖昧になった場合も、指定購入者が同じ購入操作を再試行できるようにした。本番live販売では、既存のpending注文が現在の購入条件と完全一致する場合だけ同じ注文IDを再利用し、Stripeへ同じidempotency keyで再試行する。

注文を自動でcancelしない。Stripe側ではSession作成済みだが応答だけ失われた可能性があり、自動cancelすると後着の決済完了通知と注文状態が競合するためである。

## 実装

- liveかつログイン済みbuyer profileがある場合だけ、既存pending注文を検索する。
- 次の値がすべて現在の購入条件と一致した注文だけを再利用する。
  - 購入者メール
  - buyer profile ID
  - 商品ID
  - 販売者profile ID
  - 金額
  - プラットフォーム手数料
  - 販売者売上額
  - `payment_mode=live`
  - `status=pending`
- 一致する注文がない場合は従来どおり新規pending注文を作成する。
- 同時実行でlive注文の一意制約に負けた場合は、同じ完全一致条件で1回だけ再読込する。
- 条件が一致しない場合や読込に失敗した場合はfail closedし、古い価格や別購入者の注文を再利用しない。
- Stripe Sessionは既存どおり`marketplace-checkout-${order.id}`をidempotency keyに使うため、同一注文の再試行で重複Session作成を抑止する。
- 隔離Stagingのtest販売とguest checkoutは従来どおり新規注文を作成し、再利用処理の対象外とする。

## 安全境界

- canaryの販売者・商品・指定購入者・期限判定は注文保存前とStripe呼出前の二重検査を維持する。
- liveの同一購入者・商品に対するpending／paid一意制約を維持する。
- migration、schema、RLS、Stripe metadata、Webhook、cancel token、購入download仕様は変更しない。
- Production接続、DB mutation、注文作成、Stripe接続、決済、返金、Provider実行、生成Job、credit操作は行っていない。

## 検証

- focused: 25/25
- Hub: 1157/1157
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency/module boundaries: error 0、既知warning 2
- lint、Hub／Desktop typecheck: 成功
- Supabase migration validation: 88/88
- Web／Desktop build: 成功
- RC preflight: repository structure READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: commit前に最終確認

## 次工程

commit、push、Draft PRを作成し、全GitHub CIとVercel Preview成功時点で停止する。Productionでの購入再試行、注文作成、Stripe決済は責任者の別途明示承認を必要とする。
