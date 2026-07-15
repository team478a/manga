# MANGAI Hub

ルートに残しているNext.jsアプリをMANGAI Hubと定義します。作品公開、検索、デジタル商品、Stripe Checkout、購入後ダウンロード、売上、グッズ申請、管理者機能を担当します。

詳細は [`../IMPLEMENTED_FEATURES.md`](../IMPLEMENTED_FEATURES.md) を参照してください。Desktop追加時点の正常状態はGitタグ `marketplace-mvp-2026-07-12` で保全しています。

## 起動

```powershell
npm install
npm run dev
```

HubはSupabaseとStripeのサーバー環境変数を使用します。Desktopはこれらの秘密鍵を使用しません。

## Desktop販売パッケージの取り込み

認証後、`/dashboard/import-package`でDesktopが生成した`MANGAI販売パッケージ.zip`を選択します。ブラウザ内検証とプレビュー後、作品名、説明、商品形式、商品名、価格を確認して「非公開下書きを作成」を実行します。

- 作品は`draft`・非公開で作成
- 商品は`paused`で作成
- 表紙と最大3枚のサンプルは`works` bucketへ保存
- 商品PDFまたは画像ZIPは`digital-products` bucketへ保存
- サーバー側で容量、SHA-256、PDF・ZIP・画像シグネチャを再検証

新規Supabase環境は[`../../supabase/schema.sql`](../../supabase/schema.sql)、既存環境は順序付きmigrationを使用します。適用・rollback・CI検証の手順は[`DATABASE_MIGRATIONS.md`](DATABASE_MIGRATIONS.md)を参照してください。Server Actionは最大100MBに設定していますが、公開先のリクエスト上限がこれより小さい場合は、将来の署名付き直接アップロード方式へ切り替える必要があります。

## Desktop公開状況API

`GET /api/desktop/projects/{sourceProjectId}/status`は、未認証時には販売パッケージの元Project IDに対応する公開済み作品と販売中の商品数だけを返します。非公開下書きの存在は返しません。Desktopは秘密鍵やHubログイン情報を保存しません。

端末認証後は、同じAPIへBearer tokenを付けることで、本人の非公開下書きと停止中商品も確認できます。`works:write:draft`を明示承認した端末は、`PATCH`で本人の非公開下書きの作品名・説明だけを更新できます。Hubの`/dashboard/devices`で認証端末の確認・失効、`/dashboard/devices/authorize`で15分コードとscopeの承認を行います。端末認証APIにはサーバー側の`SUPABASE_SERVICE_ROLE_KEY`が必要です。詳細は[`../desktop/HUB_DEVICE_AUTH.md`](../desktop/HUB_DEVICE_AUTH.md)を参照してください。

端末認証開始は15分あたりIP単位10回・全体300回に制限し、IPはHMAC化して保存します。専用秘密値として`DESKTOP_AUTH_RATE_LIMIT_SECRET`の設定を推奨します。期限切れ・失効済み認証と古いrate limit行は認証開始時に自動清掃します。
