# Stripe Webhook／購入download Domain Error

## 対象

- Stripe Webhook署名検証
- デジタル商品とCloud AI SubscriptionのWebhook反映
- 購入履歴からの期限付きdownload
- 決済状態とdownload回数のDB更新

## Error契約

| 失敗 | Code | HTTP |
| --- | --- | ---: |
| Webhook署名なし・不正 | `VALIDATION_ERROR` | 400 |
| Stripe／Webhook／Price設定不足 | `PROVIDER_UNAVAILABLE` | 503 |
| 購入済み注文・商品ファイル未検出 | `RESOURCE_NOT_FOUND` | 404 |
| 署名付きURL作成失敗 | `STORAGE_TRANSACTION_ERROR` | 500 |
| download記録時の購入状態変更 | `REVISION_CONFLICT` | 409 |
| DB／RPC／未知例外 | `INTERNAL_ERROR` | 500 |

Webhookは既存の`message`へ`errorCode`を追加します。購入downloadは既存の
`error`へ`errorCode`を追加します。成功時の`{ received: true }`と303
redirectは変更しません。

## 境界

- Stripe署名検証失敗とSubscription対応不正は入力Errorとして扱う
- Stripe secret、Webhook secret、Cloud AI Price未設定はProvider設定Errorとする
- `payments.ts`は注文更新時のSupabase errorを内部Errorへ変換する
- `purchases.ts`は所有者、`paid`状態、Storage、download記録を一か所で検証する
- DB、Stripe SDK、Storage、RPCの生メッセージは外部へ返さない

## セキュリティと互換性

- download対象は`buyer_profile_id`が一致する`paid`注文だけ
- signed URLの有効期間は従来どおり300秒
- download成功前に`record_order_download`を実行し、競合時はURLを返さない
- Stripe metadata、注文status、Webhook対象event、RPC、DB schemaは変更しない

## Rollback

この変更のcommitをrevertします。DB migrationや保存データのrollbackは不要です。
