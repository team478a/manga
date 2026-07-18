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

## Milestone 2: Stripe Subscription

- CreatorプランのStripe Checkoutと任意のtrial日数
- Stripe Billing Portalによる請求・解約管理
- Subscription created／updated／deletedからTrial／Creator entitlementへの変換
- Price ID、Profile metadata、製品surface、請求期間の再検証
- Stripe event IDの冪等性と、event作成時刻による古い通知の無視
- 単品デジタル商品CheckoutとSubscription eventの分離
- Dashboardのプラン・利用枠・請求管理画面

## Milestone 3: 購入履歴・再ダウンロード

- ログイン中の認証メールと購入メールが一致した注文をBuyer Profileへ関連付け
- 支払済み・返金済み注文を確認できる購入履歴画面
- 支払済み商品の5分間有効な署名付き再ダウンロードURL
- 注文ID・Buyer Profile・支払状態をServerで再照合するダウンロードAPI
- 再ダウンロード回数と最終日時の原子的な記録
- 購入者本人だけが注文を読めるRLSと、注文作成時のBuyer Profile差し替え防止
- 決済完了処理を冪等化し、再送・再表示で初回支払日時を上書きしない

## 検証

- Hub単体テスト29/29、TypeScript、ESLint、Web production build: 成功
- migration静的検査10件: 成功
- PostgreSQL 16: 購入者RLS、他人の再ダウンロード拒否、原子的回数記録、forward、全rollback、再適用、正規schema二重適用に成功

## 次の実装

## Milestone 4: Cloud Creator・Marketplace直接連携

- Cloud Projectの全Pageから商品PDFと表紙PNGをServerで再生成
- Project IDに紐づく非公開作品と停止中デジタル商品を作成・再同期
- 同じProjectの再同期では作品・商品を重複作成せず、既存下書きを更新
- Project revisionを描画後・DB確定前に再確認して競合を拒否
- 作品・商品を同一PostgreSQL transactionで更新
- 公開中作品、販売中商品、重複した作品・商品はfail closedで自動上書きしない
- Storage失敗時の新規ファイル清掃と、同期成功後の旧商品ファイル清掃
- Cloud Creator画面で同期状態、価格、商品編集導線を表示

## 検証

- Hub単体テスト30/30、TypeScript、ESLint、Web production build: 成功
- migration静的検査11件: 成功
- PostgreSQL 16: 初回作成、同一IDへの再同期、販売中商品拒否、transaction rollbackを確認

## 次の実装

## Milestone 5: 管理者運用UI

- Cloud AI全体の手動kill switch
- 日次原価上限と警告率の変更
- Free／Trial／Creator Planのcredit、原価上限、rate limit、稼働状態変更
- Provider・model・Job種別・pricing version別の価格登録と有効化／停止
- 当日実費・予約原価・予算消化率、直近14日の原価確認
- 失敗中・実行中Jobのエラー確認
- 管理操作のactor、対象、変更前後をservice role限定監査ログへ記録

## 検証

- TypeScript、ESLint、Web production build、migration静的検査12件: 成功
- PostgreSQL 16: forward、全rollback、正規schema二重適用、監査表権限境界に成功

## 次の実装

## Milestone 6: 通知・運用監視

- 利用者のcredit利用率が警告率へ到達した際のquota通知
- retry終了後の生成Job失敗通知
- 管理者向け日次予算警告と全体生成停止通知
- source単位のdedupe keyによるworker再実行時の重複防止
- worker POST完了時と認証付き監視GET時の通知refresh
- 利用者Dashboardの通知一覧、個別既読、全件既読
- 管理者Cloud AI画面のcritical／warning運用通知
- 利用者は通知本文を変更できず、本人通知の`read_at`だけ更新可能

## 検証

- Hub単体テスト30/30、TypeScript、ESLint、Web production build、migration静的検査13件: 成功
- PostgreSQL 16: 通知生成・重複防止、service role限定refresh、更新列制限、forward、全rollback、正規schema二重適用に成功

## 次の実装

1. Phase 4全体の受入れ監査と完了資料
2. 実Stripe／Supabase staging credentialを使うRC受入れ

状態: **進行中**
