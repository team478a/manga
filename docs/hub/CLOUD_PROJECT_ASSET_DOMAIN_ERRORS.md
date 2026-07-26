# Cloud Project／Asset Domain Error

更新日: 2026-07-24

## 対象

- Cloud Project作成、参照、更新、削除、復元、表紙設定
- Cloud Asset一覧、署名URL、Upload
- Desktop Project Import
- PDF／画像ZIP／販売Package Export

## Error契約

| 状況                              | errorCode                  | HTTP |
| --------------------------------- | -------------------------- | ---: |
| 未認証                            | `AUTHENTICATION_REQUIRED`  |  401 |
| Project編集不可                   | `PERMISSION_DENIED`        |  403 |
| Project／Page／Asset未検出        | `RESOURCE_NOT_FOUND`       |  404 |
| UUID、manifest、画像形式の不備    | `VALIDATION_ERROR`         |  400 |
| Asset／Import requestサイズ超過   | `PAYLOAD_TOO_LARGE`        |  413 |
| Project保存容量超過               | `QUOTA_EXCEEDED`           |  429 |
| Upload rate limit                 | `RATE_LIMITED`             |  429 |
| Storage upload／download／署名失敗| `STORAGE_TRANSACTION_ERROR`|  500 |
| DB、render、filesystemの未知例外  | `INTERNAL_ERROR`           |  500 |

レスポンスは既存互換の`{ error: string, errorCode: string }`です。
Upload rate limitの`Retry-After` headerも維持します。

## 境界

- PostgreSQL RPC signalはProject mapperでDomain Errorへ変換します。
- Asset Serviceは入力、容量、未検出、Storage失敗を用途別Errorへ変換します。
- Import／Export Serviceは検証可能な利用者エラーだけを公開します。
- Routeは`toApiError`だけでHTTPレスポンスへ変換し、未知の内部文言を返しません。
- Project Server ActionはDomain Errorの安全な文言だけをredirect URLへ渡します。

## 互換性

- DB migrationなし
- RPC、request body、成功response、download形式の変更なし
- Storage path、Import manifest、Export package形式の変更なし
- 変更点は失敗時のHTTP statusと`errorCode`の精度向上のみ

## Rollback

このPRをrevertします。DB・Storage・保存データのrollbackは不要です。
