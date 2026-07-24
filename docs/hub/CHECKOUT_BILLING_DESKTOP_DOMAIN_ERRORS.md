# Checkout／Billing／Desktop API Domain Error

更新日: 2026-07-24

## 対象

- デジタル商品のStripe Checkout Session作成
- Cloud AI Subscription Checkout／Billing Portal
- Desktop端末認証の開始、poll、失効
- DesktopからのHub作品状態照会と非公開下書き更新

## 互換Error形式

CheckoutとDesktop APIは既存Clientとの互換性のため、次の形式を維持します。

```json
{
  "message": "入力を確認してください。",
  "errorCode": "VALIDATION_ERROR"
}
```

Creator APIの`error`形式とは分離し、共通`toMessageApiError`でHTTP statusと
安定codeを付与します。Desktop公開状況GETの404／503は既存の
`linked: false`も維持します。

Billing Checkout／Portalは303 redirectを維持します。Domain Errorの安全な文言だけを
queryへ渡し、未知のStripe／DB例外は操作別fallbackへ置き換えます。

## Error対応

| 状況                           | errorCode                 | HTTP |
| ------------------------------ | ------------------------- | ---: |
| Checkout／端末入力不正         | `VALIDATION_ERROR`        |  400 |
| 未認証・無効端末token          | `AUTHENTICATION_REQUIRED` |  401 |
| Desktop draft scope不足        | `PERMISSION_DENIED`       |  403 |
| Hub作品・請求情報未検出        | `RESOURCE_NOT_FOUND`      |  404 |
| Hub下書き更新競合              | `REVISION_CONFLICT`       |  409 |
| 端末認証rate limit             | `RATE_LIMITED`            |  429 |
| Stripe／Hub DB利用不可         | `PROVIDER_UNAVAILABLE`    |  503 |
| その他の未知例外               | `INTERNAL_ERROR`          |  500 |

端末認証rate limitの`Retry-After` headerと、pending／approved／expiredなどの
成功・状態responseは変更しません。

## セキュリティ

- Stripe SDK、Supabase、rate limit RPCの生メッセージを返さない
- API key、Service Role Key、端末tokenをログ・responseへ追加しない
- Billing redirect URLへ未知の例外文言を入れない
- Desktopは従来どおりService Role KeyとStripe Secretを保持しない

## Rollback

このPRをrevertします。DB migrationと保存データのrollbackは不要です。
