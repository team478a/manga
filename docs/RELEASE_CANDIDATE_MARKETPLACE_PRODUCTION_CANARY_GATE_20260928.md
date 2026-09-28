# Marketplace Production 1件canary runtime gate

作成日: 2026-09-28
対象: 一般向けMarketplaceのProduction限定販売

## 結論

`live`設定だけで販売中商品全体の購入経路が開かないよう、承認計画の1商品・売り手・買い手・期限・fingerprintをserver側で固定するruntime gateを追加した。

環境変数、Production migration、商品、注文、Stripe、決済は変更していない。実計画が確定し、migrationとProduction限定設定が別途承認・適用されるまでは販売を開始できない。

## 多層防御

1. `live` mode自体が、有効期限24時間以内の完全なcanary設定なしでは無効になる。
2. 公開作品ページと購入画面は、対象商品とログイン済み購入者Profileが一致する場合だけ購入操作を表示する。
3. Server Actionは仮注文保存前に商品・売り手・買い手を再検証し、guestや別購入者を拒否する。
4. Stripe Session作成直前に注文行の対象を再検証し、直接API呼出しによる迂回を拒否する。
5. 本番`pending`／`paid`注文は同一商品・購入者で1件だけになるpartial unique indexを追加する。
6. 同一注文のStripe Session作成には注文ID由来のidempotency keyを使用する。

## Fail-closed条件

- access modeが`canary`でない。
- 商品、売り手、買い手のUUIDが欠落・不正・不一致。
- 売り手と買い手が同じ。
- 承認fingerprintが64桁SHA-256形式でない。
- 期限切れ、または現在から24時間を超える。
- 商品がactiveでない、作品が非公開・成人向け、Cloud完成版が固定されていない。
- 同じ商品と購入者に本番`pending`または`paid`注文が存在する。

## 未実施

- `202609280002_marketplace_live_single_purchase`のProduction適用。
- Production限定canary環境変数の設定。
- Stripe live資格情報とWebhookの設定。
- 対象計画の確定、実購入、返金。

これらはそれぞれ実行対象を固定した別の明示承認単位とする。
