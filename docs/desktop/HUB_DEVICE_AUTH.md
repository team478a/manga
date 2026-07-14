# MANGAI Desktop・Hub端末認証

## 目的

DesktopへSupabase Session、Service Role Key、Stripe Secret Keyを保存せず、利用者本人のHub作品を読み取り専用で確認できるようにします。編集、公開、商品更新、決済の権限は付与しません。

## 認証フロー

1. Desktopの「Hub連携」で「端末認証を開始」を選択します。
2. Hubは256bitのランダムな端末トークンと8桁の利用者コードを発行します。
3. Hub DBには端末トークンのSHA-256ハッシュだけを保存します。平文トークンは応答後にHubへ保存しません。
4. Desktopは平文トークンをElectron `safeStorage`でOS暗号化し、main processだけで保持します。rendererへは公開しません。
5. 利用者は15分以内にHubへログインし、Desktopと同じコードを承認します。
6. 承認後、トークンへ`works:read` scopeを90日間付与します。
7. DesktopはBearer tokenで、自分のProject IDに対応する作品と商品状態を照会します。
8. DesktopまたはHubの端末管理画面からいつでも失効できます。

## API

| API                                            | 認証       | 用途                                                           |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `POST /api/desktop/device/authorize`           | なし       | 15分間有効な端末コードを開始                                   |
| `GET /api/desktop/device/token`                | 端末Bearer | 承認状態を確認                                                 |
| `DELETE /api/desktop/device/token`             | 端末Bearer | 端末自身から失効                                               |
| `GET /api/desktop/projects/{projectId}/status` | 任意       | 未認証時は公開情報、認証時は本人の非公開下書きを含む状態を取得 |

## セキュリティ境界

- 通信先はHTTPS限定です。開発用のlocalhostだけHTTPを許可します。
- HTTP redirectは追従しません。
- 認証コードは紛らわしい文字を除いた40bit相当で、15分で失効します。
- 端末トークンは256bitで、DB漏えい時に平文を復元できない形式で保存します。
- 認証トークンは作品読み取りscopeだけを持ち、プロフィールIDが一致する作品だけを返します。
- 非認証APIは従来どおり公開済み作品だけを返します。
- HubログインCookieやSupabase Auth SessionをDesktopへ渡しません。
- Hub端末一覧では、承認日時、最終利用、有効期限を確認して個別に失効できます。

## 運用前提と残る確認

- Hubサーバーには`SUPABASE_SERVICE_ROLE_KEY`が必要です。Desktopには不要です。
- 既存環境では[`../../supabase/schema.sql`](../../supabase/schema.sql)を再実行します。
- 公開前にホスティング/CDN層で端末認証開始APIのrate limitを設定してください。
- 実Supabase、複数端末、期限切れ、失効後アクセスのE2Eは本番準備フェーズで確認します。
