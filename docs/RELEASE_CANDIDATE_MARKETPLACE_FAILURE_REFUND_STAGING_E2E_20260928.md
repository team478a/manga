# Marketplace決済失敗／全額返金 Staging E2E

作成日: 2026-09-28
対象: MANGAI Creator Marketplace
環境: Supabase Preview Branch + Vercel branch Preview + Stripe test mode

## 結果

| 検証 | 期待状態 | 結果 |
| --- | --- | --- |
| 事前分離 | Staging refと親Production refが異なる | 成功 |
| Stripe mode | `sk_test_`かつWebhook endpointがtest mode | 成功 |
| 決済失敗 | 合成注文が`pending → failed` | 成功 |
| 全額返金 | 合成注文が`paid → refunded` | 成功 |
| Webhook配送 | Stripe自身の署名配送が最新Previewへ到達 | 成功 |
| 復元 | test webhook endpointが元URLへ戻る | 成功 |
| 冪等性 | 完了後の再実行で追加更新なし | 成功 |

## 実行した操作

1. read-only preflightで、隔離Supabase、branch Preview、`sk_test_`、合成注文2件、100円test PaymentIntent、既存test webhook endpointの整合を確認した。
2. test webhook endpointを実行中だけ最新Previewへ向けた。
3. Stripe公式の拒否用test PaymentMethodでPaymentIntentを作成し、`payment_intent.payment_failed`の実配送後にStaging注文が`failed`になるまで確認した。
4. 既存test PaymentIntentへ金額省略の全額返金を実行し、`charge.refunded`の実配送後にStaging注文が`refunded`になるまで確認した。
5. 各操作の`finally`でendpointを元URLへ復元した。
6. 両操作を再実行し、完了済み状態ではStripe更新とendpoint変更を繰り返さないことを確認した。

## 安全境界

- live Stripe keyは受け付けない。
- Supabase URLと宣言Staging refが一致し、親Production refと異なる場合だけ実行する。
- branch Vercel Preview以外は受け付けない。
- Webhook endpointはtest mode、有効、Vercel保護バイパス付き、必要イベント購読済みの場合だけ使用する。
- 失敗注文は注文・商品・出品者・`payment_mode=test`のmetadataを固定する。
- 返金は保存済みtest PaymentIntentに対する全額返金だけで、金額指定による部分返金を行わない。
- 秘密値、イベントpayload、endpoint URL、保護バイパス値、内部IDを標準出力やGitへ残さない。

## 外部状態

- 変更あり: 隔離Stagingの合成注文2件、Stripe test PaymentIntent 1件、既存Stripe test PaymentIntentの全額返金。
- 一時変更後復元: Stripe test webhook endpoint URL。
- 変更なし: Production、Production DB／Storage、Stripe live、本番売上、振込、実利用者注文、生成Provider、生成Job、credit。

## 参考

- [Stripe testing](https://docs.stripe.com/testing)
- [Create a refund](https://docs.stripe.com/api/refunds/create)
- [Webhook endpoint API](https://docs.stripe.com/api/webhook_endpoints)
