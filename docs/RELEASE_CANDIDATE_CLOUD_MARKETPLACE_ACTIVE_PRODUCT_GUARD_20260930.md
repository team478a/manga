# Release Candidate: Cloud販売中商品編集ガード

作成日: 2026-09-30

Branch: `codex/cloud-marketplace-active-product-guard-20260929`

Base: `bb38d0d1`（PR #570 merge commit）

## 目的

Cloud出品後に汎用の商品編集画面から固定完成版との整合性や原子的な販売停止・再開を迂回しないよう、通常の利用画面とServer ActionでCloud連携商品の固定項目を保護する。

## 実装

- Cloud連携商品では、紐づけ作品、販売ファイル、販売状態を商品編集画面の固定表示へ変更した。
- 販売停止・再開と完成版変更はCreator作品画面へ案内する。
- 販売中の価格をread-onlyにし、価格変更はCreator作品画面で販売停止した後だけ許可する。
- Server Actionでも現在の商品・現在の作品を所有者境界内で再取得し、画面改変による以下の変更をfail closedする。
  - 紐づけ作品の変更
  - 販売ファイルの差し替え
  - 販売状態の直接変更
  - 販売中の価格変更
- 停止中Cloud商品の価格変更、商品名・説明の変更は許可する。手動登録商品は従来の作品、価格、ファイル、販売状態編集を維持する。
- 更新後は商品一覧、商品編集、公開作品、購入準備、Creator作品画面のcacheを再検証する。

## 安全境界

- migration、正規schema、RLS、既存のpublication trigger、Stripe、Checkout、注文処理は変更していない。
- 本変更は通常の利用画面とServer Actionのガードであり、所有者がSupabase APIからDBを直接更新する経路まで新たに遮断するものではない。DB trigger強化は`sync`、publication選択、出品開始、販売停止の各RPCとの互換性を同時に設計する別migrationとする。
- Production接続、migration適用、作品・商品状態変更、注文、Stripe、Storage、Provider、生成Job、credit、利用者データ変更は0件。
- Production未適用migrationは`202609290001_cloud_marketplace_listing_publish`と`202609290002_cloud_marketplace_listing_withdrawal`。前者の承認は継続しているが、適用操作は行っていない。後者は別承認が必要。

## 検証

- 集中テスト: 19/19
- Hub: 1169/1169
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency check: error 0（既知warning 2）
- lint / 全typecheck: 成功
- migration静的検証: 90/90
- Web build / Desktop build: 成功
- RC preflight: repository structure READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: 成功

## 次の停止条件

commit、push、Draft PR作成後、GitHub CIとVercel Previewがすべて成功した時点で停止する。Production migration適用、実作品の商品編集・販売停止・再開、購入、決済は別の明示承認単位とする。
