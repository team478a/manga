# Cloud Marketplace Admin Sales Recovery Release Candidate

Date: 2026-09-30

Branch: `codex/cloud-marketplace-admin-sales-recovery-20260930`

Base: `7bf3adb5157ef4bbb428a4673a3891d65c62ef1a`（PR #579 merge commit）

## Goal

管理者が注文・売上情報を一時的に取得できない場合に、注文一覧を空、注文数を0件、本番売上を0円と誤認せず、安全に再確認できる状態へ戻す。

## Implemented

- 管理者の注文一覧と注文指標を`src/modules/sales/infrastructure`のrepositoryへ分離した。
- 注文一覧は必要な8列だけを取得し、従来の新着順を維持した。
- 注文一覧の読込失敗を本当の0件と分離し、一覧を空として扱わず再読み込みを案内する。
- 管理ダッシュボードの注文数・本番売上は、安全に取得できない場合に0ではなく「確認」と表示する。
- 正常時は従来どおり、本番かつ支払済み注文だけを本番売上合計へ含め、テスト注文を除外する。

## Safety boundaries

- 管理者認証を完了してからrepositoryへアクセスする。
- 注文の作成・更新、商品、作品、購入履歴、Stripe、Webhook、振込・精算処理は変更していない。
- 注文内容、購入者メール、例外本文をログやqueryへ追加しない。
- RLS、schema、migration、Storage構造は変更していない。
- Production接続、実注文、実決済、返金、Provider実行、生成Job、credit予約・消費は0件。

## Verification

- focused admin sales recovery: 11/11
- Hub: 1189/1189
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29 screens, blocking violations 0
- dependency boundary: errors 0, existing warnings 2
- lint: passed
- Hub and Desktop typecheck: passed
- migration static validation: 92/92
- Web production build: passed
- Desktop production build: passed
- RC repository structure: READY
- `git diff --check`: passed

External Supabase／Stripe configuration and manual end-to-end sales verification remain pending. These require an isolated approved environment and are not part of this change.

## Next

Draft PRのCore quality、Migration roundtrip、Windows build、Vercel Preview、Preview Commentsがすべて成功した時点で停止する。Production設定変更、実注文・実決済、振込・精算は別の承認単位とする。
