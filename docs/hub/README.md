# MANGAI Hub

ルートに残しているNext.jsアプリをMANGAI Hubと定義します。作品公開、検索、デジタル商品、Stripe Checkout、購入後ダウンロード、売上、グッズ申請、管理者機能を担当します。

詳細は [`../IMPLEMENTED_FEATURES.md`](../IMPLEMENTED_FEATURES.md) を参照してください。Desktop追加時点の正常状態はGitタグ `marketplace-mvp-2026-07-12` で保全しています。

## 起動

```powershell
npm install
npm run dev
```

HubはSupabaseとStripeのサーバー環境変数を使用します。Desktopはこれらの秘密鍵を使用しません。

