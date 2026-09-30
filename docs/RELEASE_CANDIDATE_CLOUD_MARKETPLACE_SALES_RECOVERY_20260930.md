# Cloud Marketplace Sales Recovery Release Candidate

Date: 2026-09-30

Branch: `codex/cloud-marketplace-sales-recovery-20260930`

Base: `c47955d11bb48d09c038afffe2eda1872260edac`（PR #578 merge commit）

## Goal

出品者の注文・売上情報を一時的に取得できない場合に、受取予定額を0円、注文を0件と誤表示せず、安全に再読み込みできる状態へ戻す。

## Implemented

- 出品者の注文読込を`src/modules/sales/infrastructure`のrepositoryへ分離した。
- 認証済みプロフィールIDで`creator_id`を絞り、既存の出品者RLS境界と新着順を維持した。
- 読込失敗時は受取予定額を「確認できません」と表示し、0円として集計しない。
- 注文一覧の障害を「注文はまだありません」と分離し、一覧を空として扱わず再読み込みを案内する。
- 正常時は従来どおり、本番かつ支払済み注文だけを受取予定額へ集計し、テスト注文を除外する。

## Safety boundaries

- 注文の作成・更新、商品、作品、購入履歴、Stripe、Webhook、振込・精算処理は変更していない。
- 出品者本人以外の注文を取得する権限は追加していない。メール、注文内容、例外本文をログやqueryへ追加しない。
- RLS、schema、migration、Storage構造は変更していない。
- Production接続、実注文、実決済、返金、Provider実行、生成Job、credit予約・消費は0件。

## Verification

- focused sales recovery: 8/8
- Hub: 1186/1186
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
