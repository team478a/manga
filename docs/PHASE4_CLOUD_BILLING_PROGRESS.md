# MANGAI Cloud quota・課金・Marketplace Phase 4進捗

開始日: 2026-07-18

## Milestone 1: quota・原価統制基盤

- `free`／`trial`／`creator`のPlan契約と月間credit・原価上限
- Profile作成時のFree entitlement自動付与と月次期間更新
- Provider、model、Job種別、pricing version単位のServer管理価格表
- Job登録前のcredit・保守的最大原価予約
- 利用者期間別の予約credit、使用credit、予約原価、実原価
- immutableな予約／確定／解放ledger
- 成功時の使用確定、cancel・最終失敗時の予約解放、retry中の予約維持
- 利用者・Project・IP・全体の原子的rate limit
- 全体日次原価上限と、実費到達時の自動kill switch
- 旧Job登録RPCのauthenticated権限を除去し、quota付きRPCだけを公開
- EditorへのPlan・残credit・予約credit表示とfail-closed生成ボタン

## 安全境界

- ブラウザーから送られた推定額を信用せず、DBの有効価格表を使用する
- idempotency重複確認を予約より先に行い、同じJobでcreditを二重予約しない
- quota確認、Job作成、利用枠更新、ledger記録を1つのPostgreSQL transactionで行う
- pricing version未登録、entitlement無効、予算停止、利用枠不明ではProviderへ送信しない
- IPはHMAC化し、生の接続元アドレスをDBへ保存しない
- Cloud AI停止中も編集、保存、書き出しは継続する

## 検証

- ai-core quota判定を含む40/40
- Hub単体テスト27/27、Web production build: 成功
- TypeScript、ESLint、migration静的検査8件: 成功
- PostgreSQL 16: forward、quota予約、idempotency、cancel解放、成功確定、ledger件数、全rollback、再適用、正規schema二重適用、staging read-only検査に成功

## 次の実装

## Milestone 2: Stripe Subscription

- CreatorプランのStripe Checkoutと任意のtrial日数
- Stripe Billing Portalによる請求・解約管理
- Subscription created／updated／deletedからTrial／Creator entitlementへの変換
- Price ID、Profile metadata、製品surface、請求期間の再検証
- Stripe event IDの冪等性と、event作成時刻による古い通知の無視
- 単品デジタル商品CheckoutとSubscription eventの分離
- Dashboardのプラン・利用枠・請求管理画面

## 次の実装

1. 購入者アカウントへ注文を関連付け、購入履歴・再ダウンロードを追加
2. Cloud Creatorから非公開作品・販売商品へ差分付きで受け渡す
3. 管理者向け価格表・kill switch・費用監視UI

状態: **進行中**
