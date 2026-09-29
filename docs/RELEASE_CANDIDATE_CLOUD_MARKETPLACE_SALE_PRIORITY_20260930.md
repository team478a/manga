# Release Candidate: Cloud公開カタログ販売中優先表示

作成日: 2026-09-30

Branch: `codex/cloud-marketplace-sale-priority-20260930`

Base: `730ad5a321b3b499cf56c45d67e6d3426ac0fdf7`（PR #575 merge commit）

## 目的

公開作品一覧で販売中作品を先に発見できるようにし、カードを選択した後に作品詳細と購入準備へ進むことを明示する。

## 実装

- `active`かつ正常価格の商品がある作品を公開一覧の先頭へ並べる。
- 販売中作品同士、非販売中作品同士では既存の新着順を維持する。
- 元の作品配列を変更せず、新しい配列として並べ替える。
- 販売中カードへ`作品詳細・購入準備へ →`、その他の公開作品へ`作品を見る →`、編集カードへ`編集する →`を表示する。

## 安全境界

- カードは従来どおり作品詳細へ遷移し、一覧から注文を作成しない。
- 購入資格、canary、自己購入禁止、Server Action、Stripe、Webhook、ダウンロードを変更しない。
- migration、schema、RLS、Storage、Provider、生成Job、creditを変更しない。
- Production接続、公開状態・商品状態・注文・決済・利用者データ変更は行わない。

## 検証

- 集中テスト: 8/8
- Hub: 1181/1181
- Canvas: 26/26
- AI: 50/50
- Desktop: 407/407
- Desktop accessibility: 29画面、blocking violation 0
- dependency check: error 0、既知warning 2
- lint、全typecheck: 成功
- migration静的検査: 92/92
- Web／Desktop build、RC repository structure、`git diff --check`: 成功
- 外部設定と手動E2E: 既知PENDING

## 停止条件

commit、push、Draft PR作成後、全GitHub CIとVercel Previewが成功した時点で停止する。Production migration適用、一般購入解禁、実購入・実決済は別承認単位とする。
