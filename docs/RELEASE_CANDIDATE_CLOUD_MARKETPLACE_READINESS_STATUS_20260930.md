# Cloud限定販売 readiness表示 Release Candidate

作成日: 2026-09-30

Branch: `codex/cloud-marketplace-readiness-status-20260930`

Base: `b23928f123129d4adfd7aacf910f4559d9245727`（PR #580 merge commit）

## 目的

限定販売の購入設定が停止中・隔離テスト・限定本番のどの状態かを、管理者が秘密情報を開示せず確認できるようにする。設定不整合や期限切れcanaryを、実購入を行わずに発見できる状態を完成条件とする。

## 実装

- 管理画面 `/admin/marketplace-canary` に「限定販売の購入設定」パネルを追加した。
- checkout modeを「停止中」「隔離テスト」「限定本番」として表示し、READY／PENDINGと安全な理由を表示する。
- 限定本番ではcanaryの有効状態、失効日時、残り時間だけを表示する。
- 既存のcheckout mode検査へ時刻注入点を追加し、期限切れを再現可能なテストでfail closedと確認した。

## 安全性

- Stripe秘密鍵、商品・出品者・購入者の内部ID、canary fingerprintは返却・表示しない。
- 管理者認証より前にreadiness検査を実行しない。
- DB、環境変数、注文、決済、Stripe、Webhook、RLS、schema、migrationは変更しない。
- Production接続、実購入・実決済、Provider実行、Job実行、credit操作は0件。

## 検証

- focused: 31/31成功、追加regression: 7/7成功
- Hub: 1194/1194成功
- Canvas: 26/26成功
- AI: 50/50成功
- Desktop: 407/407成功
- Desktop accessibility: 29画面、blocking violation 0
- migration静的検査: 92/92成功
- dependency検査: error 0、既知warning 2
- lint、Hub/Desktop typecheck、Web build、Desktop build、RC repository structure、diff check成功
- 外部Supabase／Stripe設定と手動E2Eは既知`PENDING`

## 次

Draft PRを作成し、Core quality、Migration roundtrip、Windows build、Vercel Preview、Preview Commentsの成功時点で停止する。Production設定変更や実決済は別承認単位とする。
