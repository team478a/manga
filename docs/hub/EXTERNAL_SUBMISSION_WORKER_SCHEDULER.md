# External Submission Worker Scheduler

更新日: 2026-10-11

## 目的

外部作品応募は、creatorが検証開始を明示するとingest Jobを`queued`へ登録し、内部endpoint
`POST /api/internal/external-submissions/worker`が1回につき最大1 Jobを処理します。Worker endpoint、
lease付きclaim、malware scan、画像検証、非公開page保存は実装済みですが、endpointを安全に呼ぶ
Schedulerがなかったため、Production Jobは自動では進みませんでした。

このSchedulerはGitHub Actionsから認証付きでWorkerを呼びます。Production設定とClamAV接続が
揃うまで既定で停止し、手動実行も既定値は通信しない`check`です。明示的な`probe`はWorkerの
認証付き`GET`だけを呼び、ClamAVへframed `PING`を1回送ります。Job claim、scan、Storage、DB更新は
行いません。

## 実行構成

- GitHub Actions `External submission Worker scheduler`が5分間隔で起動する。
- Repository variableが厳密に`true`のときだけscheduled実行する。
- 1 workflowでWorker requestは1回、処理対象は最大1 Jobに限定する。
- `probe`はFeature Flag停止中にも実行でき、ClamAVの正確な`PONG`だけをreadyとする。
- `idle`、`completed`、`failed`のいずれでも同一workflow内の追加requestは行わない。
- workflow concurrencyは1本に限定し、実行中workflowをcancelしない。
- Worker側のDB leaseと`for update skip locked`で二重claimを防ぐ。
- 応答のsubmission ID、error code、Storage path、利用者情報、秘密値をログへ出さない。

## GitHub設定

Repositoryの`Settings > Secrets and variables > Actions`へ次を設定します。

### Variable

| 名前 | 値 | 初期値 |
| --- | --- | --- |
| `MANGAI_EXTERNAL_SUBMISSION_SCHEDULER_ENABLED` | `true`で定期実行 | 未設定（停止） |

### Secrets

| 名前 | 内容 |
| --- | --- |
| `MANGAI_EXTERNAL_SUBMISSION_WORKER_URL` | `https://app.mang-ai.com/api/internal/external-submissions/worker` |
| `MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET` | Vercelの同名Secretと同じ32文字以上の値 |

URLはHTTPSかつ上記Worker pathだけを許可します。query、fragment、埋め込みcredentialは拒否します。
値をRepository、PR、Issue、実行ログへ貼りません。

## Vercel設定

Schedulerの`run`を実行する前にProduction側で次を確認します。`probe`ではFlagを`false`のまま
維持し、Jobを処理せずClamAV疎通だけを確認できます。

- `MANGAI_EXTERNAL_SUBMISSION_WORKER_ENABLED=true`
- `MANGAI_EXTERNAL_SUBMISSION_WORKER_SECRET`: GitHub Secretと同じ32文字以上の値
- `MANGAI_EXTERNAL_CLAMAV_HOST`: Vercel ProductionからTCP接続できる専用ClamAV endpoint
- `MANGAI_EXTERNAL_CLAMAV_PORT`: 通常は`3310`
- `MANGAI_EXTERNAL_SUBMISSION_WORKER_ID`: 任意。未設定時は既定値を使用する
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

ClamAV endpointはインターネットへ無認証公開しません。接続元制限、private network、または同等の
network controlを必須とし、疎通確認前にFeature Flagを有効化しません。ClamAVが未設定または接続不能の
場合、scanは`unavailable`となり、Jobはretryable failureとして安全に停止します。

## 安全な開始手順

1. Draft PRのCIとVercel Previewが成功していることを確認する。
2. Vercel ProductionへFlag=`false`、Worker secret、ClamAV接続設定を反映する。
3. GitHub ActionsへWorker URLと同じWorker secretを登録する。Repository variableは未設定のままにする。
4. `Run workflow`の既定`check`を実行し、Workerへ通信せずGitHub側設定だけを確認する。
5. Flag=`false`のまま`workflow_dispatch / probe`を1回実行し、認証付きGETとClamAV `PING`がreadyになることを確認する。Jobはclaimされない。
6. Vercel ProductionでFlag=`true`を反映する。
7. Queue、lease、対象Jobが意図した1件だけであることをread-only確認する。
8. `workflow_dispatch / run`を1回だけ実行し、`queued -> running -> completed`、2 page生成、owner isolationを確認する。
9. 定期処理を開始する場合だけRepository variableを`true`にする。

Production環境変数、GitHub secret／variable、redeploy、Worker runはそれぞれ別の変更として、対象と
停止条件を提示し、action-time承認を得てから実行します。

## 停止・復旧

通常停止はRepository variableを`false`または未設定にします。即時停止が必要な場合はVercelの
`MANGAI_EXTERNAL_SUBMISSION_WORKER_ENABLED=false`を設定し、その値を反映するProduction redeployを
実施します。Vercel環境変数の変更だけでは既存deploymentへ反映されません。

`failed`応答後は同一workflow内で再試行しません。retryable failureはDBの試行上限内で次回runに
再claimされますが、canaryでは原因を確認するまで次のrunを行いません。感染検出、形式不正、重複page等の
非retryable failureは手動修正なしに再試行しません。

## ローカル検査

```powershell
$env:MANGAI_EXTERNAL_SUBMISSION_SCHEDULER_ENABLED = "false"
npm run external-submission:worker:scheduler:preflight
node --test tests/external-submission-worker-scheduler.test.mjs
```

停止時のpreflightは`DISABLED`を表示し、外部通信を行いません。
