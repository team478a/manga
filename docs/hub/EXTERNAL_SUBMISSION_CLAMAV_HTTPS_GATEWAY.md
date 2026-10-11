# External Submission ClamAV HTTPS Gateway

更新日: 2026-10-11
状態: `IMPLEMENTED / HOSTING_NOT_SELECTED / PRODUCTION_DISABLED`

## 目的と範囲

Vercel上の外部作品応募Workerから、認証・暗号化されたHTTPSでscan gatewayを呼び出し、gatewayだけが
private network上の`clamd`へINSTREAM接続する。実装はportableなNode.js containerであり、hosting、
cloud、region、DNS、証明書、secret、Production環境変数はこの工程では作成・変更しない。

## 境界

- 公開面は`GET /healthz`、認証必須の`GET /v1/readiness`と`POST /v1/scan`だけ。
- scanは`application/octet-stream`、正確な`Content-Length`、最大50 MiB。応答は固定statusだけ。
- Bearer secretは32文字以上。本文、ClamAV応答、Storage path、利用者情報、secretをログへ出さない。
- TLSは信頼済みreverse proxyで終端する。`MANGAI_CLAMAV_GATEWAY_TRUST_PROXY=true`を明示し、proxyが
  client由来の`X-Forwarded-Proto`を除去・上書きする構成だけを許可する。
- gatewayから`clamd`へのTCPは同一hostまたはprivate network内に限定し、公開Internetへ出さない。
- 1 processにつきscanは1件だけ。最初のcanaryまではinstance数も1に固定する。分散concurrency制御なしで
  scale-outしない。
- timeout、認証失敗、過大入力、不明応答、ClamAV障害はすべて`unavailable`へfail closedする。

## Gateway環境変数

| 名前 | 契約 |
| --- | --- |
| `MANGAI_CLAMAV_GATEWAY_SECRET` | 32文字以上。専用Secret Storeで生成・保管・rotationする |
| `MANGAI_CLAMAV_HOST` | gatewayから到達できるprivate clamd host。明示必須 |
| `MANGAI_CLAMAV_PORT` | 既定`3310` |
| `MANGAI_CLAMAV_GATEWAY_TRUST_PROXY` | TLS終端proxy構成では厳密に`true` |
| `MANGAI_CLAMAV_GATEWAY_MAX_BYTES` | 既定・上限とも50 MiB |
| `MANGAI_CLAMAV_GATEWAY_TIMEOUT_MS` | 既定15秒、1〜60秒 |
| `PORT` | 既定`8080` |

`MANGAI_CLAMAV_GATEWAY_REQUIRE_HTTPS=false`はloopbackを使うisolated test専用で、Productionでは禁止する。

## Worker環境変数

| 名前 | 契約 |
| --- | --- |
| `MANGAI_EXTERNAL_CLAMAV_TRANSPORT` | `https_gateway` |
| `MANGAI_EXTERNAL_CLAMAV_GATEWAY_URL` | HTTPS originだけ。path、query、fragment、埋め込みcredentialは禁止 |
| `MANGAI_EXTERNAL_CLAMAV_GATEWAY_SECRET` | gatewayと同じ32文字以上のsecret |

既存の`tcp` transportはprivate VPC構成との後方互換用に残す。両方式を同時に設定せず、transportを明示する。

## ContainerとClamAV

`services/external-submission-clamav-gateway/Dockerfile`はgatewayだけを含み、ClamAV engineやsignature DBを
含まない。hosting時はprivate clamd serviceを別途用意し、`freshclam`更新、更新時刻、engine health、容量、
再起動を監視する。gatewayの`/healthz`はprocess livenessだけ、`/v1/readiness`は認証済みClamAV疎通を示す。

## 検証とProduction gate

ローカル統合テストはfake clamdでframing、clean／infected、認証、TLS proxy条件、50 MiB上限、fail-closedを
確認する。EICARは隔離された非Production環境だけで使い、実利用者原稿や実malwareをfixtureにしない。

Productionへ進む前に、hosting provider、region、月額上限、運用担当、trusted proxy設定、private clamd、
signature監視、secret rotation手順を決定する。その後もgateway配置、Vercel設定、redeploy、readiness probe、
対象Job 1件のWorker runは別々のaction-time承認を必要とする。実決済は行わない。
