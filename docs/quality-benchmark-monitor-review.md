# モニター向け漫画画像Human Review

## 目的

招待済みの一般向けモニターへ、権利確認済みのBenchmark専用画像だけを割り当て、既定5名の独立Human Reviewをスマートフォンから実施できるようにする。

この画面は既存作品の品質フィードバックとは別である。顧客作品、Production作品、モニター作品、権利未確認画像は登録しない。

## 利用者導線

- モニター状況: `/dashboard/monitor`
- 品質確認: `/dashboard/monitor/quality-review`
- 1画像ずつ、`good / borderline / bad`、確信度1〜5、許可された欠陥分類、コメントを入力する。
- 入力は約0.9秒後に下書き保存される。画像ごとの確定後、全画像を最終送信する。
- 画像以外の正解情報、他Reviewerの回答、正解label、AI監査は表示しない。

## 管理者導線

- 進捗: `/admin/general-monitors/quality-review`
- `draft` Batchは、権利確認、元package SHA-256、期間、画像28枚、既存割当0件をサーバーで再検査してから`active`へ変更する。
- Batchの有効化／停止／再開は管理者だけが実行でき、状態更新は取得時の状態が変わっていない場合だけ成功する。
- Feature Flag停止中でもBatchの検査と有効化はできるが、担当割当とモニター画面公開はできない。
- 有効なBatchへ、異なるモニターを既定5名（最大9名）まで割り当てる。Batchごとの目標人数を超える枠はapplicationとDB triggerの両方で拒否する。
- Primary Reviewer A/Bは正式Benchmark v2比較用、Panel Reviewer C以降は補助票であり、回答schemaを混在させない。
- 管理画面は確定件数、開始確認、最終送信だけを表示し、回答payloadを読み込まない。

## 保存契約

- `cloud_monitor_quality_review_batches`: 権利確認者と確認日時、元package SHA-256、期間、状態、目標確認者数（既定5、2〜9）。
- `cloud_monitor_quality_review_cases`: 中立case ID、表示順、許可欠陥分類、非公開Storage path、画像SHA-256と寸法。
- `cloud_monitor_quality_review_assignments`: Reviewer A〜I、同意、進捗。同じBatchで同一人物を複数枠へ割り当てられない。
- `cloud_monitor_quality_review_responses`: Reviewerごとの下書き／確定回答。既存`mangai-human-review-v2` recordと同じ判定規則をapplicationで検査する。
- 4テーブルはauthenticatedへの直接権限を持たない。本人限定Security Definer RPCだけが同意、保存、最終送信を受け付ける。

## 画像保護

- private bucket `manga-quality-review`を使用する。
- 画像APIは、ログイン、一般モニター有効状態、専用Feature Flag、本人assignment、case所属を毎回確認する。
- 画像URLは120秒の署名URLで、公開URLは作成しない。
- Prompt、Provider／model、source group／family、split、顧客情報、内部URL、秘密値を保存しない。

## 有効化条件

1. migration `202608180001_cloud_monitor_quality_review`と`202608180002_cloud_monitor_quality_review_panel`をCIでroundtrip確認し、対象環境へ順番に適用済みであることを確認する。
2. 人間による権利確認が全件完了した専用画像だけをprivate bucketへ登録する。
3. 元package SHA-256、画像SHA-256、寸法、case setを照合する。
4. 管理画面からBatchの事前条件を再検査し、`active`にする。この操作だけではモニターへ公開されない。
5. `CLOUD_GENERAL_MONITOR_BETA_ENABLED=true`に加え、`MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=true`を対象環境だけへ設定する。
6. Feature Flag有効化後、異なるモニターをPrimary A/B、Panel C〜Eへ割り当てる。Batch開始時刻より前は割当を拒否する。
7. 390×844相当のスマートフォンで、同意、画像表示、下書き再開、画像確定、最終送信を確認する。

権利確認が未完了のBatchは登録・有効化しない。private Batch 01はHuman権利確認28/28を完了済みである。

## 権利確認完了契約

`mangai-rights-review-v1` packageの構造検査と、人間による完了判定は分離する。配布前の空templateは通常のpackage validatorを通過できるが、モニターBatch取込には`--require-complete`が必須である。

`rights-response.private.json`は、確認者名、offset付き確認日時、Provider利用規約確認を持ち、全画像に次の判定を記録する。AIやスクリプトで人間の承認を補完しない。

```json
{
  "template_version": "mangai-rights-review-response-v1",
  "batch_id": "private-batch-01",
  "verified_by": "人間の確認者名",
  "verified_at": "2026-08-18T12:00:00+09:00",
  "terms_reviewed": true,
  "records": [
    {
      "image_id": "img_0001",
      "decision": "approved",
      "provider_terms_confirmed": true,
      "benchmark_use_approved": true,
      "no_customer_or_production_content": true,
      "no_personal_information": true,
      "no_adult_content": true,
      "notes": ""
    }
  ]
}
```

1件でも`approved`でない、または必須確認が`true`でない場合は、Batch全体を取込不可とする。画像ID、SHA-256、PNG、寸法、必須Content Credentialsも再検査する。

```powershell
npm run manga:benchmark:rights-package:validate -- `
  --package C:\private\completed-rights-review.zip `
  --expected-count 28 `
  --require-complete
```

## 隔離draft取込

取込CLIは既定でdry-runし、DB／Storageを変更しない。Human完了検査、28件集合、画像SHA-256、寸法を通過したときだけ取込予定を返す。

```powershell
npm run manga:benchmark:monitor-batch:admit -- `
  --package C:\private\completed-rights-review.zip `
  --batch-code batch_private_01 `
  --created-by-profile-id 00000000-0000-4000-8000-000000000000 `
  --starts-at 2026-08-20T00:00:00+09:00 `
  --expires-at 2026-09-20T00:00:00+09:00 `
  --expected-count 28
```

既定の実取込先はstagingのまま維持する。Stagingを用意しない運用では、`--target-environment production`を明示し、Benchmark専用テーブルとprivate bucketへ非公開`draft`としてだけ登録できる。一般のSupabase環境変数へfallbackせず、URLから得たproject ref、専用環境変数、コマンド引数を一致させる。

Production draft取込には、対象project ref、Batch code、固定確認句の三重確認と、実在する管理者profile IDを必須にする。通常作品、Canvas、公開Storage、Reviewer割当、Feature Flagは変更しない。次の例は操作契約であり、責任者確認前に実行しない。

```powershell
$env:MANGAI_MONITOR_REVIEW_PRODUCTION_PROJECT_REF = "PRODUCTION_PROJECT_REF"
$env:MANGAI_MONITOR_REVIEW_PRODUCTION_SUPABASE_URL = "https://PRODUCTION_PROJECT_REF.supabase.co"
$env:MANGAI_MONITOR_REVIEW_PRODUCTION_SERVICE_ROLE_KEY = "ローカルだけに設定するproduction key"

npm run manga:benchmark:monitor-batch:admit -- `
  --package C:\private\completed-rights-review.zip `
  --batch-code batch_private_01 `
  --created-by-profile-id 00000000-0000-4000-8000-000000000000 `
  --starts-at 2026-08-20T00:00:00+09:00 `
  --expires-at 2026-09-20T00:00:00+09:00 `
  --expected-count 28 `
  --target-environment production `
  --apply `
  --confirm-production-project PRODUCTION_PROJECT_REF `
  --confirm-production-draft-batch batch_private_01 `
  --acknowledge-production-write BENCHMARK_PRIVATE_DRAFT_ONLY
```

実取込後もBatchは`draft`で停止する。CLI自身がDBのBatch状態・case件数・割当0件と、private Storageから再取得した28画像のSHA-256を検査する。別途管理画面でも確認してからだけ`active`化し、目標人数分の異なるモニターを割り当てる。CLIは一般の`NEXT_PUBLIC_SUPABASE_URL`や`SUPABASE_SERVICE_ROLE_KEY`を読まない。

## 停止とロールバック

- 即時停止: `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=false`として再デプロイする。既存の一般モニター制作機能には影響しない。
- 個別停止: assignmentを`revoked`、またはBatchを`paused`へ変更する。
- Panel rollback: C〜Iのassignmentが0件であることを確認してから`supabase/rollbacks/202608180002_cloud_monitor_quality_review_panel.sql`を実行する。C〜Iが存在する場合は削除せずfail closedで停止する。
- 全体DB rollback: 対象環境と保存件数を確認し、回答を安全な場所へ退避した後、`supabase/rollbacks/202608180001_cloud_monitor_quality_review.sql`を実行する。
- Storageの削除は対象Batch IDの完全一致を確認して実施する。Productionで自動実行しない。

## 次工程への停止条件

- Draft PRの全CIとVercel Previewが成功する。
- migration roundtripとモバイル実機確認が完了する。
- 人間による権利確認が完了するまではProductionへ画像を登録しない。
- Primary A/B回答を正式Benchmarkへ採用する前に、既存validatorでHuman response契約と独立性を再検査する。Panel C以降は補助評価として別集計する。
- 責任者確認前にR4-3B Visual Judge本体へ進まない。
