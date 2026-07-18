# Cloud AI Worker 運用手順

更新日: 2026-07-18

## 構成

Webアプリは画像・文章Providerを直接呼ばず、Server専用のMANGAI Cloud AI Gatewayへ送信する。Gateway側で実ProviderのAPI、非同期polling／webhook、Provider固有の認証と応答形式を吸収する。ブラウザーへGateway keyやProvider keyを渡さない。

Workerは`POST /api/internal/cloud-ai/worker`を1回呼ぶごとに、永続QueueからJobを最大1件claimして処理する。定期実行基盤はこのendpointを短い間隔で呼び、同時実行数は費用上限に合わせて制御する。

## 必須環境変数

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
MANGAI_CLOUD_AI_WORKER_SECRET=32-characters-or-more-random-secret
MANGAI_CLOUD_AI_WORKER_ENABLED=true
MANGAI_CLOUD_AI_WORKER_ID=production-worker-1
MANGAI_CLOUD_AI_WORKER_LEASE_SECONDS=300
MANGAI_CLOUD_AI_GATEWAY_ENDPOINT=https://gateway.example.com/v1/generate
MANGAI_CLOUD_AI_GATEWAY_KEY=server-only-gateway-key
MANGAI_CLOUD_IMAGE_ENABLED=true
MANGAI_CLOUD_IMAGE_MODEL=approved-image-model
MANGAI_CLOUD_IMAGE_PRICING_VERSION=provider-price-2026-07
MANGAI_CLOUD_TEXT_ENABLED=true
MANGAI_CLOUD_TEXT_MODEL=approved-text-model
MANGAI_CLOUD_TEXT_PRICING_VERSION=provider-price-2026-07
```

初期値は停止状態にする。Gateway疎通、moderation、料金上限、Storage保存をstagingで確認してから`MANGAI_CLOUD_AI_WORKER_ENABLED=true`へ変更する。pricing versionが未設定のProviderもfail closedで無効になる。mock Providerはproductionでは常に無視される。

## Gateway契約

- 画像: `{MANGAI_CLOUD_AI_GATEWAY_ENDPOINT}/image`
- 文章: `{MANGAI_CLOUD_AI_GATEWAY_ENDPOINT}/text`
- Method: `POST`
- 認証: `Authorization: Bearer ...`
- 冪等性: `X-MANGAI-Idempotency-Key`
- Job追跡: `X-MANGAI-Job-Id`
- productionはHTTPS必須、redirect禁止、既定timeout 120秒
- HTTP 429と5xxだけを一時障害として限定retry
- Gateway応答には`moderation`を必須化し、`allow`以外は保存しない

Gatewayは同じidempotency keyで実Providerを二重課金しないこと。実Providerが非同期の場合、Gateway内部でpollingまたはwebhookを完了させてから共通応答を返す。

## 起動と監視

```powershell
$headers = @{ Authorization = "Bearer $env:MANGAI_CLOUD_AI_WORKER_SECRET" }
Invoke-RestMethod -Method Post -Uri "https://app.example.com/api/internal/cloud-ai/worker" -Headers $headers
Invoke-RestMethod -Method Get -Uri "https://app.example.com/api/internal/cloud-ai/worker" -Headers $headers
```

監視GETは`enabled`、`queued`、`running`、`failed`、`staleLeases`、秘密値を含まないProvider一覧を返す。少なくとも次をalert対象にする。

- `staleLeases > 0`が連続する
- `queued`が増え続ける
- `failed`が急増する
- schedulerのHTTP 401、500、503
- Provider実費が運用上限へ到達する

停止時は最初に`MANGAI_CLOUD_AI_WORKER_ENABLED=false`へ変更する。編集、保存、書き出しは継続し、新しい生成要求はProvider registryを無効化することでfail closedにできる。

## Staging受入れ

1. 一般向け画像fixtureを登録し、完成AssetをPageへ配置する。
2. 一般向け文章fixtureを登録し、Canvasへ追加する。
3. 同一idempotency keyを再送してJobと課金が増えないことを確認する。
4. 成人向けfixtureがGateway access logへ1byteも送られないことを確認する。
5. 429、5xx、timeoutが上限内でretryされ、4xxとmoderation拒否はretryされないことを確認する。
6. Worker停止中も編集、保存、PDF／PNG／販売パッケージ書き出しが成功することを確認する。

実Gatewayのcredential、契約モデル、価格、schedulerはデプロイ環境の運用設定であり、リポジトリへ保存しない。
