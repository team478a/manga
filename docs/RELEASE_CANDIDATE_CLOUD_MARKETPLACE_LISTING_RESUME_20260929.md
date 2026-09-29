# Release Candidate: Cloud出品の安全な再開

作成日: 2026-09-29

Branch: `codex/cloud-marketplace-listing-resume-20260929`

Base: `790b8fd2`（PR #569 merge commit）

## 目的

販売停止後の作品を再出品するとき、初回出品と同じ安全条件を再確認し、意図しない一般公開や新規販売を防いだうえで再開できるようにする。

## 実装

- Creator作品画面の販売状態を`販売中`または`未公開・停止中`として明示する。
- 出品操作を`出品を開始・再開する`へ統一し、初回出品と販売停止後の再出品の両方を案内する。
- 一般公開と新規販売の開始・再開を確認する必須checkboxを追加した。確認値が欠ける場合はServer Actionでfail closedする。
- 既存の`publish_cloud_marketplace_listing(uuid)`を再利用する。このRPCは所有権、一般向け区分、固定完成版、完全な連番ページ、単一商品、価格、販売ファイル、完成版PDFとの一致を同一transaction内で再検証する。
- 再開後にCreator、作品一覧、作品編集、商品編集、公開作品、購入準備画面のcacheを再検証する。
- 販売停止中も購入済み利用者の利用権と注文履歴が維持され、再開によって失われないことを画面に明記した。

## 非変更範囲

- migration、正規schema、RLS、Stripe、Checkout、注文、決済、返金、販売対象者判定は変更していない。
- Production接続、migration適用、作品公開、商品active化、注文、Stripe操作、Storage、Provider、生成Job、credit、利用者データ変更は0件。
- `202609290001_cloud_marketplace_listing_publish`はProduction適用承認済みだが、Chrome連携のrequest-header policyエラーにより未適用。承認は取り消されていない。
- `202609290002_cloud_marketplace_listing_withdrawal`はmerge済み・Production未適用であり、適用には別の明示承認が必要。

## 検証

- 集中テスト: 13/13
- dependency check: error 0（既知warning 2）
- lint / 全typecheck: 成功
- Hub: 1164/1164
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- migration静的検証: 90/90
- Web build / Desktop build: 成功
- RC preflight: repository structure READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: 成功

## 次の停止条件

commit、push、Draft PR作成後、GitHub CIとVercel Previewがすべて成功した時点で停止する。Production migration適用、実作品の出品開始・停止・再開、購入、決済は別の明示承認単位とする。
