# Cloud Export Worker Scheduler

更新日: 2026-10-07

## 原因

Durable Exportは、利用者操作で`cloud_export_jobs`へJobを作成し、内部endpoint
`POST /api/internal/cloud-export/worker`が1回につき1segmentを処理する設計です。
Worker endpoint、lease付きclaim、segment保存、再開処理は存在していましたが、Repositoryには
このendpointを定期的に呼び出すSchedulerがありませんでした。そのため、手動でWorkerを呼ばない
Production Jobは`queued`のまま進みませんでした。

販売下書き用PDFは同期処理内で完結する別経路です。PDF生成primitiveは共通ですが、長編の中断再開、
lease、segment保存を維持するため、Durable Exportを販売下書きの同期処理へ置き換えません。

## 実行構成

- GitHub Actions `Cloud export Worker scheduler`が5分間隔で起動する。
- Repository variableが厳密に`true`のときだけscheduled実行する。
- 1 workflowで最大3segmentを順番に処理する。
- `segment_completed`と`completed`だけ次の呼び出しへ進む。
- `idle`と`failed`は直ちに停止し、失敗を同一workflow内で連打しない。
- workflow concurrencyは1本に限定し、実行中workflowをcancelしない。
- Worker側のDB leaseと`for update skip locked`で二重claimを防ぐ。
- Worker応答本文、Job ID、Storage path、利用者情報、秘密値をログへ出さない。

## GitHub設定

Repositoryの`Settings > Secrets and variables > Actions`へ次を設定します。

### Variable

| 名前 | 値 | 初期値 |
| --- | --- | --- |
| `MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED` | `true`で定期実行 | 未設定（停止） |

### Secrets

| 名前 | 内容 |
| --- | --- |
| `MANGAI_CLOUD_EXPORT_WORKER_URL` | `https://app.mang-ai.com/api/internal/cloud-export/worker` |
| `MANGAI_CLOUD_EXPORT_WORKER_SECRET` | Vercelの同名Secretと同じ32文字以上の値 |

URLはHTTPSかつ上記Worker pathだけを許可します。query、fragment、埋め込みcredentialは拒否します。
値をRepository、PR、Issue、実行ログへ貼りません。

## Vercel設定

Schedulerを実行する前にProduction側で次を確認します。

- `MANGAI_CLOUD_EXPORT_WORKER_ENABLED=true`
- `MANGAI_CLOUD_EXPORT_WORKER_SECRET`: GitHub Secretと同じ値
- `MANGAI_CLOUD_EXPORT_WORKER_ID`: 任意
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

値を表示しない環境確認は`npm run cloud:export:preflight`を使用します。

## 安全な開始手順

1. Draft PRのCIとVercel Previewが成功していることを確認する。
2. `Run workflow`の既定`check`を実行し、通信なしで設定を確認する。
3. Queue件数、期限切れlease、対象Jobが1件であることを読み取り確認する。
4. 2ページの非公開作品で`run`を1回だけ明示実行する。
5. `queued -> running -> completed`、PDF download、owner isolationを確認する。
6. 定期処理を開始する場合だけRepository variableを`true`にする。

`run`は手動選択が必要で、Repository variableが停止中でもcanaryを1回実行できます。Production Job、
環境変数、Repository variableの変更は、それぞれの実行時承認なしに行いません。

## 停止・復旧

通常停止はRepository variableを`false`または未設定にします。即時停止が必要な場合はVercelの
`MANGAI_CLOUD_EXPORT_WORKER_ENABLED=false`を先に設定します。既存Jobは削除されず、`queued`または
lease切れ後の`running`として再開できます。

失敗時は同一workflow内で再試行しません。次回scheduled実行でDBの`max_attempts`範囲内だけ再claim
されます。最大試行後は`failed`となり、利用者の明示的な「失敗箇所から再開」を待ちます。

## Storage cleanup

segment page PNGと分割PDFは既存`cloud_storage_cleanup`へ登録され、完成後24時間、中止・最終失敗後
7日で削除候補になります。最終`manuscript.pdf`は削除対象外です。実削除は既存のCloud Storage
Lifecycle Workerが担当するため、Export SchedulerはStorage objectを直接削除しません。

## ローカル検査

```powershell
$env:MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED = "false"
npm run cloud:export-worker:scheduler:preflight
node --test tests/cloud-export-worker-scheduler.test.mjs
```

停止時のpreflightは`DISABLED`を表示し、外部通信を行いません。
