# Cloud Export Production 受入れ計画

更新日: 2026-10-09  
対象: `feature/manga-canvas-mvp` / PR #623  
状態: `PLAN_COMPLETE / PRODUCTION_CHANGE_NOT_STARTED / LIVE_JOB_RECHECK_REQUIRED`

## 1. 目的と境界

Durable PDF ExportのProduction受入れを、既存の非公開2ページExport Job 1件だけで安全に実施するための計画です。受入れでは次を確認します。

`queued -> running -> completed -> PDF download成功`

あわせて、二重claim・二重segment生成がないこと、PDFが2ページであること、ページ順と内容が元の完成版に一致すること、所有者以外が取得できないことを確認します。

この文書作成時点では、Production DB、Vercel環境変数、GitHub ActionsのSecret／Variable、Scheduler、Export Job、Storage objectを変更していません。Worker呼び出しも実施していません。

## 2. 監査基準

| 項目 | 確認結果 | 根拠 |
| --- | --- | --- |
| 基準HEAD | `8032a06a2a113508ec2e18de249689053f226340` | 2026-10-09に`origin/feature/manga-canvas-mvp`をfetchして確認 |
| PR #623 | `MERGED` | merge commit `a23e551db65f84cb3bfa72e3beeb6ebe9f1fa7aa` |
| PR #624 | `MERGED` | merge commit `8032a06a2a113508ec2e18de249689053f226340` |
| Scheduler workflow | 存在 | `.github/workflows/cloud-export-worker-scheduler.yml` |
| Worker endpoint | Productionへデプロイ済み | 資格情報なしPOSTを`401`で拒否。DB処理前に認証境界で停止 |
| Production deployment | `Ready` | Vercel project `mangai-hub-staging`、alias `https://app.mang-ai.com` |

GitHub、Vercelとも秘密値の値は取得・表示・記録していません。設定名と設定有無だけを確認しました。

## 3. 現在の設定状況

### 3.1 GitHub Actions

| 設定 | 状態 | 判定 |
| --- | --- | --- |
| `MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED` Repository Variable | 未設定 | Scheduler停止中 |
| `MANGAI_CLOUD_EXPORT_WORKER_URL` Actions Secret | 未設定 | 手動`check`／`run`不可 |
| `MANGAI_CLOUD_EXPORT_WORKER_SECRET` Actions Secret | 未設定 | 手動`check`／`run`不可 |
| workflow permissions | `contents: read` | 必要最小限 |
| concurrency | 1、実行中をcancelしない | 二重workflowを抑止 |
| cron | `*/5 * * * *` | 5分間隔のbest-effort設定 |
| 1 workflowの上限 | 最大3 segment | bounded |
| 1 request timeout | 285秒 | Vercel関数の300秒より短い |

2026-10-09時点のworkflow履歴は8件で、すべてscheduled eventの`skipped`でした。Variable未設定による想定どおりの停止状態です。GitHubのscheduled eventはbest-effortであり、cron式どおりの厳密な5分SLAとはみなしません。初回受入れは必ず手動`run`を使用します。

### 3.2 Vercel Production

次の設定名がProduction targetに存在することを確認しました。

| 設定名 | 存在 | 値の確認 |
| --- | --- | --- |
| `MANGAI_CLOUD_EXPORT_WORKER_ENABLED` | あり | 未取得。`true`かは未確認 |
| `MANGAI_CLOUD_EXPORT_WORKER_SECRET` | あり | 未取得。GitHub側との一致は未確認 |
| `MANGAI_CLOUD_EXPORT_WORKER_ID` | あり | 未取得 |
| `MANGAI_CLOUD_DURABLE_EXPORT_FORMATS_ENABLED` | あり | 未取得 |
| `NEXT_PUBLIC_SUPABASE_URL` | あり | 未取得 |
| `SUPABASE_SERVICE_ROLE_KEY` | あり | 未取得 |

Production deploymentは`Ready`です。環境変数の存在だけでは有効値・Secret一致を証明できないため、GitHubの通信なし`check`と、承認後の1件canaryで確定します。

### 3.3 Worker認証と接続条件

- 認証は`Authorization: Bearer <secret>`です。
- Secretは32文字以上で、比較は`timingSafeEqual`です。
- Workerは認証成功後に`MANGAI_CLOUD_EXPORT_WORKER_ENABLED`が厳密に`true`か確認します。
- SchedulerのURLはHTTPS（localhostのみHTTP可）、固定path `/api/internal/cloud-export/worker`、credential／query／fragmentなしに制限されます。
- WorkerはSupabase Service Roleでclaim RPCを呼びます。一般利用者からWorker RPCを実行できません。
- Vercel ProductionとGitHub ActionsのWorker Secretは同一である必要があります。

## 4. 不足設定・未確定事項

| 項目 | 状態 | 解消方法 |
| --- | --- | --- |
| GitHub Worker URL Secret | 不足 | 承認後、固定Production URLをSecretへ設定 |
| GitHub Worker Secret | 不足 | 承認後、Vercelと同じ値をSecretへ設定 |
| Scheduler Variable | 未設定 | canary合格後、定期運用を開始する別承認まで未設定を維持 |
| Vercel Worker Enabledの値 | 未確認 | 値を表示しないProduction preflight、または承認後canaryのHTTP結果で確認 |
| Vercel/GitHub Secret一致 | 未確認 | 値を表示せず、GitHub `check`成功とcanary認証成功で確認 |
| 既存2ページJobの現在状態 | `BLOCKED` | Production SQL Editorまたは管理画面で個人情報を出さず再照会 |
| 対象以外のclaim可能Job | `BLOCKED` | canary直前に件数を再照会。1件以外なら実行禁止 |
| PDF実ファイル | 未生成／未確認 | canary完了後、所有者UIからdownloadして検査 |

過去の引継ぎには2ページJobが`queued`、`0/2`だった記録がありますが、現在状態の代用にはしません。ブラウザー接続が利用できなかったため、2026-10-09のlive DB再照会は未実施です。

## 5. 検証対象Jobの確定

Productionで個人名、メール、Job ID、Storage pathを記録せず、次の集計だけを確認します。

```sql
select
  status,
  format,
  total_pages,
  completed_pages,
  attempt_count,
  max_attempts,
  count(*) as job_count
from public.cloud_export_jobs
where total_pages = 2
  and status in ('queued', 'running')
group by status, format, total_pages, completed_pages, attempt_count, max_attempts;

select
  status,
  count(*) as claimable_job_count
from public.cloud_export_jobs
where (
    status = 'queued'
    or (status = 'running' and lease_expires_at <= now())
  )
  and completed_pages < total_pages
group by status;
```

次をすべて満たす場合だけ対象を確定します。

1. 非公開テスト作品のPDF Jobが1件である。
2. `total_pages=2`、`completed_pages=0`、`format='pdf'`である。
3. claim可能Jobの総数が対象1件だけである。
4. 対象外の期限切れ`running` Jobがない。
5. `attempt_count < max_attempts`である。
6. 対象作品の2ページが完成版として固定済みで、実行中の画像生成がない。

Schedulerは`completed`後も最大3 segmentまで次のJobをclaimできます。claim可能Jobが2件以上なら、対象を限定できないためcanaryを実行しません。

## 6. 本番有効化手順

### Gate 0: 実行承認前

1. この計画のPRと全品質ゲートを完了する。
2. Productionの設定名とdeployment `Ready`を再確認する。
3. 前節のread-only SQLで対象1件だけを確定する。
4. 対象作品と期待する2ページの目視比較用資料を準備する。
5. 責任者から、Secret設定と手動canary 1回の実行承認を得る。

### Gate 1: 通信なし設定確認

1. GitHub Actions Secret `MANGAI_CLOUD_EXPORT_WORKER_URL`を設定する。
2. GitHub Actions Secret `MANGAI_CLOUD_EXPORT_WORKER_SECRET`をVercelと同一値で設定する。
3. Repository Variableは未設定のまま維持する。
4. workflow_dispatchの`check`を1回実行する。
5. `READY Cloud export scheduler`だけを確認し、値がlogへ出ていないことを確認する。

### Gate 2: 1件canary

1. 実行直前にclaim可能Jobが対象1件だけであることを再確認する。
2. workflow_dispatchの`run`を1回だけ実行する。
3. 新しい`run`を重ねず、完了または失敗まで監視する。
4. Job状態、segment件数、完成outputの有無をread-onlyで確認する。
5. 所有者UIからPDFを1回downloadし、2ページ、順番、内容、破損なしを確認する。
6. 別の未購入／非所有アカウントから直接取得できないことを確認する。

### Gate 3: 定期運用

canary合格後も自動では有効化しません。別の明示承認を得た場合だけRepository Variable `MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED=true`を設定します。

## 7. 期待する状態遷移と証跡

| 段階 | DB状態 | 期待する証跡 |
| --- | --- | --- |
| 実行前 | `queued`, `0/2`, progress 0 | 対象1件、他のclaim可能Job 0件 |
| claim | `running`, leaseあり、attempt増加 | 同じJobを別Workerがclaimできない |
| 完成 | `completed`, `2/2`, progress 100、leaseなし | segment 1件、完成outputあり、finished_atあり |
| download | DB状態不変 | 所有者のみ署名URL取得、HTTP成功 |
| 内容確認 | DB状態不変 | PDF 2ページ、順序・内容一致、破損なし |

2ページは既定segment size 4以内なので、正常時は1 segmentで完成します。`running`は短時間で通過する可能性があるため、開始・完了時刻、attempt、segmentの一意性を併用して遷移を確認します。

二重処理防止は次で確認します。

- active Jobのpartial unique indexが維持されている。
- claim RPCが`FOR UPDATE SKIP LOCKED`とleaseを使用している。
- `cloud_export_segments(job_id, segment_index)`が一意で、対象Jobのsegment 0が1件だけである。
- 同一Projectに別のactive Export Jobが作成されていない。
- `manuscript.pdf`が1つで、完成後にJobのattemptが増加していない。

## 8. retry・timeout・停止条件

### retryとtimeout

- Scheduler request timeoutは285秒、Vercel関数上限は300秒、DB leaseは300秒です。
- Workerが`failed`を返した場合、同じworkflowでは停止します。
- retry可能失敗は、`attempt_count < max_attempts`の間だけDBで`queued`へ戻ります。
- 成功segment確定時はattemptが0へ戻ります。
- 最大試行後は`failed`となり、利用者の明示的な再開を待ちます。
- 未知の内部例外は`export_failed`へ正規化され、秘密情報や利用者データを保存・表示しません。

### 実行前の停止条件

- claim可能Jobが対象1件ではない。
- 対象が非公開2ページPDF Jobではない。
- 対象のページ、完成版、所有者、revisionの整合性を確認できない。
- GitHub `check`がREADYでない。
- Production deploymentがReadyでない。
- Secret一致を安全に確認できない。
- 監視担当者と即時停止担当者が揃っていない。

### 実行中・実行後の停止条件

- HTTP 401／403／503／5xx、timeout、malformed response。
- Worker statusが`failed`または未知値。
- 対象外Jobの状態が変わった。
- segment重複、completed page数超過、複数outputを検出した。
- 5分を超えてlease更新・状態変化がない。
- PDFが2ページでない、破損、順序違い、内容違い。
- 非所有者がdownloadできる。

異常時は定期Schedulerを有効化せず、その時点で受入れを中止します。自動で再実行、Job削除、Storage削除、DB修正は行いません。

## 9. 停止・ロールバック方法

### 通常停止

1. Repository Variable `MANGAI_CLOUD_EXPORT_SCHEDULER_ENABLED`を`false`または未設定にする。
2. 実行中のGitHub Actions runがあればcancelする。
3. in-flight requestは最大300秒で完了し得るため、DB leaseとJob状態を確認してから次の判断を行う。

### endpointの緊急停止

1. Vercel Productionの`MANGAI_CLOUD_EXPORT_WORKER_ENABLED=false`へ変更する。
2. 変更を反映するProduction redeployを実施する。
3. 承認済みの安全な確認方法で503を確認する。

Vercelの環境変数変更は既存deploymentへ自動反映されないため、緊急停止をendpointへ反映するにはredeployが必要です。これらはProduction変更であり、実行時の明示承認が必要です。

### Secret事故

GitHubとVercelのSecretを同時にrotateし、Vercelをredeployします。値をIssue、PR、log、文書へ貼りません。

### Job復旧

- `queued`: 設定修正後に再実行可能。
- lease切れ`running`: claim RPCが再claim可能。
- `failed`: 原因解消後、所有者の明示的な「失敗箇所から再開」を使用する。
- `completed`: 再実行しない。

Job、segment、完成PDFを削除して巻き戻しません。中間Storageのcleanupは既存Lifecycle Workerの責務で、Export Schedulerから実行しません。

## 10. Productionへの影響

| 操作 | 影響 |
| --- | --- |
| Secret／Variable設定 | GitHubまたはVercelの運用設定を変更 |
| 手動`check` | 外部通信・DB変更なし |
| 手動`run` | Service Roleで1件をclaimし、ページPNG、segment PDF、完成PDFをprivate Storageへ書き込み、Jobを更新 |
| PDF download | 短時間の署名URL発行。Job状態は変更しない |
| 定期Scheduler有効化 | claim可能な全Export Jobを5分cronで継続処理 |

Provider実行、AI credit消費、Marketplace公開、商品販売、注文、Stripe決済、成人向けMarketplaceには触れません。

## 11. 明示承認が必要な操作

次は、この計画の承認だけでは実施しません。

1. GitHub Actions Secret 2件の作成・変更。
2. Repository Variableの作成・変更。
3. Vercel Production環境変数の変更。
4. Production redeploy。
5. workflow_dispatch `run`によるWorker呼び出し。
6. Production Export Jobの再開・中止・削除・直接更新。
7. Production Storage objectの削除。
8. 定期Schedulerの有効化。

## 12. 受入れ判定

### PASS

- 対象1件だけが`queued -> running -> completed`となる。
- `2/2`、progress 100、segment 0が1件、完成PDFが1件である。
- PDFが2ページで、内容・順序が正しい。
- 所有者download成功、非所有者は拒否。
- 他Job、Marketplace、決済、Provider、creditへ影響がない。

### FAIL

PASS条件のいずれかを満たさない、または停止条件に該当する。

### BLOCKED

Production設定値の安全な確認、対象1件の確定、実行承認、所有者／非所有者の検証アカウントのいずれかが不足する。
