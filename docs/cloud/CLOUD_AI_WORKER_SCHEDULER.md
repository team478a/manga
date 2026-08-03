# Cloud AI Worker Scheduler

更新日: 2026-08-04

## 目的

一般向けCloud AI Queueを、管理者の手動実行に依存せず少量ずつ処理する。
GitHub Actionsのscheduled workflowが本番Worker endpointを5分間隔で呼び出す。
現在のVercelプランに短周期Cronを追加しないため、Vercelのデプロイ設定は変更しない。

## 安全境界

- 初期状態は停止。Repository variableが厳密に`true`のときだけJobを実行する
- URL、認証Secret、HTTPSを通信前に検証する
- 1回のscheduled workflowで最大3件まで処理する
- `idle`、`retrying`、`lease_lost`では直ちに終了する
- workflowの同時実行を禁止し、前のWorkerをcancelしない
- Worker応答本文、Provider error、Prompt、画像、利用者ID、Secretをログへ出さない
- 成人向けJobの許可境界、quota、原価予約、moderationは既存Worker側で維持する

## GitHub設定

Repositoryの`Settings > Secrets and variables > Actions`へ次を設定する。

### Variable

| 名前 | 値 | 初期値 |
| --- | --- | --- |
| `MANGAI_CLOUD_AI_SCHEDULER_ENABLED` | `true`で起動 | 未設定（停止） |

### Secrets

| 名前 | 内容 |
| --- | --- |
| `MANGAI_CLOUD_AI_WORKER_URL` | `https://app.mang-ai.com/api/internal/cloud-ai/worker` |
| `MANGAI_CLOUD_AI_WORKER_SECRET` | Vercelの同名Secretと同じ32文字以上の値 |

値はリポジトリ、PR、Issue、実行ログへ貼らない。Schedulerを起動する前に本番Vercel側で
`MANGAI_CLOUD_AI_WORKER_ENABLED=true`と同じWorker Secretが設定されていることを確認する。

## 起動手順

1. Draft PRの全CIとVercel Previewを確認する
2. 本番管理画面`/admin/cloud-ai`でQueue、期限切れlease、直近失敗を確認する
3. GitHub Actions Secretsを保存する
4. Repository variableを`true`にする
5. `Cloud AI Worker scheduler`を`Run workflow`で1回だけ手動実行する
6. 実行ログが`idle`または安全な終了状態であることを確認する
7. 一般向けテストJobを1件登録し、次回実行で完了することを確認する

この実装作業では実Providerへの有料リクエストを行わない。

## 停止・復旧

緊急停止はRepository variableを`false`にする。さらに即時停止が必要ならVercelの
`MANGAI_CLOUD_AI_WORKER_ENABLED=false`を先に設定する。Queue内のJobは失われない。

復旧前に管理画面で期限切れlease、失敗件数、Provider設定、利用上限を確認する。
`retrying`または`lease_lost`を短時間に反復実行しない。

## 制約

GitHub Actionsのscheduled workflowは厳密なリアルタイム実行ではなく、混雑時に遅延する
可能性がある。5分未満の処理開始保証や高いthroughputが必要になった段階で、専用Queue
consumerへ移行する。workflowはdefault branchへマージされるまで定期実行されない。

## ローカル検査

```powershell
$env:MANGAI_CLOUD_AI_SCHEDULER_ENABLED = "false"
npm run cloud:ai-worker:scheduler:preflight
node --test tests/cloud-ai-worker-scheduler.test.mjs
```

停止時のpreflightは`DISABLED`を表示し、外部通信を行わない。
