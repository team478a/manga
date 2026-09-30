# Cloud Marketplace Purchase Recovery Release Candidate

Date: 2026-09-30

Branch: `codex/cloud-marketplace-purchase-recovery-20260930`

Base: `aeb9e28d658a08d7d5bd5688955f4eb99de10088`（PR #577 merge commit）

## Goal

限定テスト販売の購入後に一時的なDB・Storage障害が起きても、「購入履歴なし」と誤表示したり、利用者へJSONを直接表示したりせず、安全に再試行できる画面へ戻す。

## Implemented

- 購入履歴repositoryのerrorを空配列と区別し、障害時は空履歴を表示しない。
- 履歴の読込障害では、購入情報は削除されていないことと再読み込み操作を案内する。
- ブラウザ操作によるダウンロード失敗は、既知のDomain Error codeだけを`download_error`として購入履歴へ303 redirectする。
- 購入履歴は既知codeを安全な日本語案内へ変換し、不明なquery値は表示しない。
- APIクライアント向けのJSON Error契約は維持する。

## Safety boundaries

- 注文所有者、`paid`条件、5分間の署名URL、ダウンロード回数の原子的記録は変更していない。
- 生の例外内容、Storage path、署名URL、メール、利用者情報をqueryやログへ追加しない。
- Stripe、Webhook、注文状態、商品、作品、RLS、schema、migration、Storage構造は変更していない。
- Production接続、実注文、実決済、返金、Provider実行、生成Job、credit予約・消費は0件。

## Verification

- focused purchase recovery: 15/15
- Hub: 1184/1184
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

External Supabase／Stripe configuration and manual end-to-end checkout remain pending. These require an isolated approved environment and are not part of this change.

## Next

Draft PRのCore quality、Migration roundtrip、Windows build、Vercel Preview、Preview Commentsがすべて成功した時点で停止する。Production設定変更、実購入、一般購入解禁は別の承認単位とする。
