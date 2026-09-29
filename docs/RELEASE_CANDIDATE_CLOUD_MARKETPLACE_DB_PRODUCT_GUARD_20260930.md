# Release Candidate: Cloud商品DB編集ガード

作成日: 2026-09-30

Branch: `codex/cloud-marketplace-db-product-guard-20260930`

Base: `99c41e3b6f55814e145f1bd80d34291420ee6d15`（PR #571 merge commit）

## 目的

Cloud連携商品について、通常画面とServer Actionを迂回した所有者のSupabase API直接更新でも、固定完成版との不整合や販売状態の分離を作らないようDB triggerで保護する。Creator作品画面の正規RPCによる同期、完成版選択、出品開始、販売停止は維持する。

## 実装

- `202609300001_cloud_marketplace_product_edit_guard` migration、rollback、正規schema、manifestを追加した。
- `authenticated` roleからCloud連携商品を直接作成する操作を`cloud_product_creator_managed`で拒否する。
- 既存または更新先がCloud連携作品である商品について、`authenticated` roleからの以下の直接変更を拒否する。
  - 紐づけ作品
  - 販売ファイル
  - 販売状態
  - 販売中の価格
- 商品名・説明と停止中の価格変更は許可する。手動登録商品には新しい固定項目制約を適用しない。
- 既存の`cloud_product_publication_required`検査を維持し、未公開または固定完成版未選択のCloud作品の商品を販売中にできないようにする。
- 最小migration bootstrapに`file_url`列が存在しない場合も適用できるよう、行全体triggerと`to_jsonb`による任意列比較を使用する。

## 正規RPCとの互換性

- Creator経路の同期、完成版選択、出品開始、販売停止は既存の`security definer` RPCを使用する。
- triggerは実行中の`current_user`を確認するため、直接の`authenticated`更新を拒否しつつ、所有権と整合性を再検証する正規RPCの更新を許可する。
- 隔離PostgreSQL 16で、`authenticated`の停止中価格変更が成功し、販売状態変更・作品付け替え・Cloud商品直接作成が拒否されること、`security definer`関数による正規更新が成功することを実動作で確認した。

## 安全境界

- Production接続、migration適用、作品・商品状態変更、注文、Stripe、Storage、Provider、生成Job、credit、利用者データ変更は0件。
- Production未適用migrationは以下の3件。
  - `202609290001_cloud_marketplace_listing_publish`: 適用承認済みだが未適用。
  - `202609290002_cloud_marketplace_listing_withdrawal`: 未適用。別承認が必要。
  - `202609300001_cloud_marketplace_product_edit_guard`: 未適用。merge後の別承認が必要。
- service roleなど運用管理roleの更新は本triggerの対象外とし、管理運用経路を維持する。

## 検証

- 集中テスト: 16/16
- Hub: 1173/1173
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency check: error 0（既知warning 2）
- lint / 全typecheck: 成功
- migration静的検証: 91/91
- PostgreSQL 16: 91 forward、直接authenticatedガード、security-definer互換、91 rollback、91 re-forward、正規schema二重適用に成功
- Web build / Desktop build: 成功
- RC preflight: repository structure READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: 成功

## 次の停止条件

commit、push、Draft PR作成後、GitHub CIとVercel Previewがすべて成功した時点で停止する。Productionへのmigration適用と実作品・実商品の操作は別の明示承認単位とする。
