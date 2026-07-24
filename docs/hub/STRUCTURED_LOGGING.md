# Hub Structured Logging／監視基盤

## 目的

MANGAI Hubの重要なServer処理を1行JSONで記録し、request単位の追跡と
log-based alertを可能にします。Hubはserverless環境を前提とするため、
アプリ内fileへは保存せずstdout／stderrへ出力します。

## Log schema

```json
{
  "at": "2026-07-24T00:00:00.000Z",
  "level": "info",
  "service": "mangai-hub",
  "event": "stripe_webhook_processed",
  "context": {
    "requestId": "edge:request-123",
    "method": "POST",
    "path": "/api/stripe/webhook"
  }
}
```

`x-request-id`が安全な形式なら引き継ぎ、不正または未指定ならUUIDを生成します。
Stripe Webhook、購入download、Cloud AI Worker、主要Desktop連携APIでは
同じIDをログへ記録し、主要応答の`x-mangai-request-id`にも返します。

## Redaction

次をkey名と文字列patternの両方で除外します。

- authorization、cookie、password、secret、token、API key、署名
- Prompt、negative Prompt、入力画像、mask、byte、base64、input／output JSON
- email、表示名、bio、説明、note、title
- Bearer token、Stripe形式key、JWT、secret付きquery、URL認証情報
- 未知Errorのmessage、stack、Supabase error details／hint

未知Errorは`INTERNAL_ERROR`、Domain Errorは安定codeだけを記録します。
ログ出力自体が失敗しても業務処理へ例外を伝播しません。

## Level

`MANGAI_HUB_LOG_LEVEL`で`debug`、`info`、`warn`、`error`を指定します。
未指定・不正値の既定は`info`です。本番は`info`を推奨します。

## Event catalog

| Event | Level | 意味 |
| --- | --- | --- |
| `stripe_webhook_processed` | info | 署名検証済みeventの処理完了 |
| `stripe_webhook_failed` | error | 署名、設定、DB反映の失敗 |
| `purchase_download_issued` | info | 所有者確認・履歴記録後にURL発行 |
| `purchase_download_failed` | error | 購入、Storage、履歴記録の失敗 |
| `cloud_ai_worker_run_completed` | info | Worker 1 run完了 |
| `cloud_ai_worker_run_failed` | error | Worker run失敗 |
| `cloud_generation_orphan_scan_failed` | error | 孤立Asset scan失敗 |
| `cloud_generation_storage_cleanup_pending` | error | 補償削除失敗 |
| `desktop_device_authorization_started` | info | 端末認証開始 |
| `desktop_device_authorization_*_failed` | error | 端末認証処理失敗 |
| `desktop_hub_draft_updated` | info | Desktopから下書き更新完了 |
| `desktop_hub_*_failed` | error | Desktop Hub連携失敗 |

## 推奨alert

公開環境のlog sinkで次を設定します。

1. `cloud_ai_worker_run_failed`が5分に3件以上
2. `cloud_generation_storage_cleanup_pending`が1件でも15分未解決
3. `stripe_webhook_failed`の`INTERNAL_ERROR`または
   `PROVIDER_UNAVAILABLE`が5分に3件以上
4. `purchase_download_failed`が10分に5件以上
5. `*_unauthorized`が5分に20件以上

通知先、保持期間、担当者、acknowledge手順は本番hosting選定後に設定します。
ログ本文へPrompt、画像、購入者email、tokenを追加してはいけません。

## Rollback

統合箇所と`hub-logger.ts`をrevertします。API response body、DB、Storage、
Desktop IPC、保存形式にrollbackはありません。
