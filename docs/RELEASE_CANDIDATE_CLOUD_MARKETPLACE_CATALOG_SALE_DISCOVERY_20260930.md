# Release Candidate: Cloud公開カタログ販売情報

作成日: 2026-09-30

Branch: `codex/cloud-marketplace-catalog-sale-discovery-20260930`

Base: `c84d8e57b68b79d04ae1f6b3b48bd30f5c718eed`（PR #572 merge commit）

## 目的

Cloud作品を出品した後、公開作品一覧だけで商品有無、販売モード、価格を確認できるようにし、購入者が作品詳細と購入準備へ進む前の発見性を改善する。

## 実装

- 公開作品一覧の取得時に、公開RLSを通過した`active`商品の`price`、`status`だけを同時に取得する。
- 一覧カードへ以下を表示する。
  - Stripe隔離テスト販売が利用可能: `テスト販売中`
  - Production live canaryが利用可能: `限定販売中`
  - Checkoutが無効または未設定だが販売中商品がある: `商品あり`
  - 商品が1件: 税込価格
  - 商品が複数: 最低税込価格に`から`を付ける
- 停止中・アーカイブ済み商品、不正な価格は一覧の販売情報へ含めない。
- 商品がない作品、Creator側の編集用カード、既存の検索・タグ絞り込みは従来どおり維持する。

## 安全境界

- 表示専用の変更であり、購入可否、指定購入者canary、自己購入禁止、注文作成、Stripe、Webhook、ダウンロード、売上計算は変更していない。
- 一覧カードから直接注文を作成しない。既存の作品詳細、購入準備、Server Actionで同じ購入資格を再検証する。
- migration、schema、RLS、Storage、Provider、生成Job、creditは変更していない。
- Production接続、公開状態変更、商品状態変更、注文、決済、返金、利用者データ変更は0件。
- 一般公開販売、振込、精算確定は引き続き未提供。今回の表示を一般購入解禁として扱わない。

## 検証

- 集中テスト: 12/12
- Hub: 1176/1176
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0（初回はElectron画面走査前に一時終了し、同一HEAD再実行で成功）
- dependency check: error 0（既知warning 2）
- lint / 全typecheck: 成功
- migration静的検証: 91/91
- Web build / Desktop build: 成功
- RC preflight: repository structure READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: 成功

## 次の停止条件

commit、push、Draft PR作成後、GitHub CIとVercel Previewがすべて成功した時点で停止する。Production設定変更、一般購入解禁、実購入、決済は別の明示承認単位とする。
