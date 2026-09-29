# Cloud Marketplace Buyer Entry Hardening Release Candidate

Date: 2026-09-30

Branch: `codex/cloud-marketplace-buyer-journey-20260930`

Base: `338cd57c3f2d31c27cd1dd24a02afe30a438a77f`（PR #576 merge commit）

## Goal

公開作品を見つけた購入者が、対象商品では購入準備へ進み、必要ならログイン後に同じ購入準備へ戻り、決済確認後は購入履歴と再ダウンロードへ進める導線を完成させる。

## Implemented

- 公開作品詳細では、固定したlive canaryの商品・売り手が一致する場合、未ログインでも`購入準備へ`を表示する。
- 未ログイン利用者は購入準備でログインし、同じcheckout URLへ戻る。購入実行は従来どおり固定buyerとの完全一致が必要である。
- checkoutの直接アクセスでも、商品がactive、作品がpublicかつgeneral、Cloud作品では固定publicationが現在版であることを再検証する。
- 固定canary以外の商品は購入準備の対象外としてfail closedする。
- 決済完了画面は、署名済み参照またはStripe sessionのpaid確認が取れた場合だけ`決済完了`を表示する。確認できない場合は完了を断定しない。
- 決済確認後にダウンロード取得だけが失敗した場合は、決済済みであることを保ったまま購入履歴からの再取得を案内する。

## Safety boundaries

- live購入実行時の固定product／seller／buyer、24時間期限、fingerprint、自己購入禁止は緩和していない。
- 作品詳細と購入準備の表示だけでは注文を作成しない。
- Stripe session、Webhook、注文repository、RLS、schema、migration、Storageは変更していない。
- Production接続、実注文、実決済、返金、Provider実行、生成Job、credit予約・消費は0件。
- 一般購入の全面解禁ではなく、既存の固定canaryだけを対象にする。

## Verification

- focused buyer journey: 17/17
- Hub: 1183/1183
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

Draft PRのCore quality、Migration roundtrip、Windows build、Vercel Preview、Preview Commentsがすべて成功した時点で停止する。merge後のProduction設定変更、canary実購入、一般購入解禁はそれぞれ別の承認単位とする。
