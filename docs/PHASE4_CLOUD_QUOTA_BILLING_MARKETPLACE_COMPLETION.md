# MANGAI Phase 4 Cloud quota・課金・Marketplace統合 完了記録

完了日: 2026-07-18

## 完了判定

Phase 4のリポジトリ実装、DB migration、画面、単体・統合テスト、運用資料は完了した。Cloudは一般漫画専用、成人向けはDesktopのlocal LLM／許可済みDezgoに限定する既存製品境界を維持している。

| 要件 | 完了根拠 |
| --- | --- |
| Free／Trial／Creator Plan | `cloud_ai_plans`、Profile entitlement自動付与、Stripe entitlement同期 |
| 生成credit・Job前quota | quota付きenqueue RPCでcredit・最大原価をtransaction予約。旧RPCの利用者権限を除去 |
| Provider実費ledger | reserve／settle／releaseのimmutable ledger、retry・cancel・最終失敗の精算 |
| rate limit | User／Project／HMAC IP／Globalの原子的window制限。上限拒否をPostgreSQLで検証 |
| 予算警告・自動停止 | 日次予約・実費集計、警告率通知、実費到達時の自動kill switch |
| 管理者kill switch・監視 | `/admin/cloud-ai`で全体停止、Plan、価格、原価、失敗Job、通知、監査履歴を管理 |
| Stripe entitlement | Subscription Checkout／Portal、署名webhook、Price・metadata・期間検証、event冪等性・順序保証 |
| Cloud Creator販売導線 | ProjectからPDF・表紙を生成し、非公開作品・停止中商品へrevision付きtransaction同期 |
| 購入履歴・再ダウンロード | Buyer Profile関連付け、支払済み履歴、5分署名URL、原子的回数記録、返金後停止 |
| 通知・運用監視 | quota、最終失敗、予算警告、生成停止のdedupe通知、利用者既読管理、管理者通知 |
| セキュリティ | 一般向けcontent boundary、RLS、service role限定worker／ledger／通知refresh、監査ログ |

## 最終検証

- Hub: 30/30
- AI core: 40/40
- Canvas core: 26/26
- Desktop統合: 83/83
- TypeScript、ESLint: 成功
- Web production build、Desktop production build: 成功
- migration静的検査: 13件
- PostgreSQL 16: forward、quota・ledger・rate limit・Stripe順序・購入者RLS・自動停止・通知dedupe、全rollback、再適用に成功
- 正規`schema.sql`: 二重適用、Marketplace同期behaviorに成功

## リリース候補で行う外部受入れ

以下は秘密値と外部環境を必要とするデプロイ受入れであり、リポジトリ実装の未完了ではない。

1. Supabase stagingへ13 migrationを適用しread-only preflightを実行
2. Stripe test modeでSubscription Checkout、Portal、署名webhookを実行
3. 実Cloud AI Gatewayで画像・文章を各1件生成し、Provider請求値とledgerを照合
4. 予算警告と停止通知をstagingの運用アカウントで確認

Phase 4以降の機能拡張は、メール／Push通知、長時間export Job、Marketplace検索・クーポン・税務処理を別Phaseとして扱う。
