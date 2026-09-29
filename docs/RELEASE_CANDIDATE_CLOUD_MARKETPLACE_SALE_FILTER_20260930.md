# Release Candidate: Cloud公開カタログ販売中フィルター

作成日: 2026-09-30

Branch: `codex/cloud-marketplace-sale-filter-20260930`

Base: `a0e1e8dbebdc75dd3892fd6c2c2b60081d9b3b92`（PR #574 merge commit）

## 目的

公開作品一覧から販売中の商品がある作品だけを確認できるようにし、限定テスト販売の購入者が対象作品を見つけやすくする。

## 実装

- 公開作品一覧へ`販売中の作品だけを見る`フィルターを追加する。
- 検索語とタグを変更しても販売中フィルターを維持し、解除時も検索語とタグを維持する。
- `active`かつ0円以上の有限価格を持つ商品だけを販売中として扱う。
- 販売中フィルター適用後の件数と空状態を表示する。
- クリエイター表示名RPCは表示対象の作品IDだけを取得する。

## 安全境界

- 表示専用であり、作品・商品・注文・公開状態を変更しない。
- 購入資格、指定購入者canary、自己購入禁止、Server Action再検証、Stripe、Webhook、ダウンロードを変更しない。
- 一覧から注文を作成せず、作品詳細と購入準備を従来どおり経由する。
- migration、schema、RLS、Storage、Provider、生成Job、creditを変更しない。
- Production接続・実データ操作・実決済は行わない。

## 検証

- 集中テスト: 7/7
- Hub: 1180/1180
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency check: error 0、既知warning 2
- lint、全typecheck成功
- migration静的検査: 92/92
- Web／Desktop build成功
- RC repository structure: READY。外部設定と手動E2Eは既知PENDING
- `git diff --check`: 成功

## 停止条件

commit、push、Draft PR作成後、全GitHub CIとVercel Previewが成功した時点で停止する。Production migration適用、一般購入解禁、実購入・実決済は別承認単位とする。
