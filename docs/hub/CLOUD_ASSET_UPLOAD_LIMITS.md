# Cloud Asset Uploadのサイズ・rate limit

## 適用上限

- 画像本体: 20 MiB
- multipart request全体: 21 MiB
- decode対象: 100,000,000 pixels以下
- 画像寸法: 幅・高さそれぞれ20,000px以下
- user rate limit: 30回／分
- IP rate limit: 60回／分
- IP不明時: 10回／分

## API処理順

1. `Content-Length`が21 MiBを超える場合、認証やbody展開前に`413`を返す
2. 認証とuser／IP rate limitを確認する
3. Request streamを読み、21 MiBを超えた時点でcancelして`413`を返す
4. multipartを解析し、画像本体が20 MiBを超える場合も`413`を返す
5. MIME宣言、実形式、decode、pixel数、寸法、SHA-256をServerで検証する
6. RLSで編集可能な一般向けProjectだけを取得し、StorageとAsset情報を保存する

`Content-Length`は最適化にだけ利用し、信頼しません。header欠落・過少申告でもstream実測値で停止します。MIME偽装、破損画像、pixel bombはStorage保存前に拒否します。

## Reverse proxy

Nginx用設定は[`../../deploy/nginx/mangai-upload-limits.conf`](../../deploy/nginx/mangai-upload-limits.conf)です。HTTPS server blockへincludeし、転送元で`X-Forwarded-For`を外部入力のまま信用しない構成にしてください。

Vercelなどプラットフォーム固有のrequest上限が21 MiB未満の場合、このmultipart endpointで20 MiBを保証できません。その環境では、次期改善として署名付き直接uploadとServer側finalize検証へ移行します。現在の実装は既存Canvas UIとの互換性を維持しながら、アプリが受け取るbodyを最大21 MiBへ制限しています。

## 応答

- `413 Payload Too Large`: requestまたは画像本体の上限超過
- `429 Too Many Requests`: user／IP rate limit超過。`Retry-After: 60`
- `401`: 未認証
- `403`: Profile未作成
- `400`: multipart、MIME、decode、SHA-256などの検証失敗

## 確認

```powershell
node --experimental-strip-types --test tests/cloud-asset-upload.test.mjs
npm run hub:test
npm run typecheck
npm run lint
```

PostgreSQL migration assertionでは、所有者のAsset登録成功と、別利用者によるprivate Projectへの登録拒否を確認します。
