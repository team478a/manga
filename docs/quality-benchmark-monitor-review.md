# モニター向け漫画画像Human Review

## 目的

招待済みの一般向けモニターへ、権利確認済みのBenchmark専用画像だけを割り当て、Reviewer A/Bの独立Human Reviewをスマートフォンから実施できるようにする。

この画面は既存作品の品質フィードバックとは別である。顧客作品、Production作品、モニター作品、権利未確認画像は登録しない。

## 利用者導線

- モニター状況: `/dashboard/monitor`
- 品質確認: `/dashboard/monitor/quality-review`
- 1画像ずつ、`good / borderline / bad`、確信度1〜5、許可された欠陥分類、コメントを入力する。
- 入力は約0.9秒後に下書き保存される。画像ごとの確定後、全画像を最終送信する。
- 画像以外の正解情報、他Reviewerの回答、正解label、AI監査は表示しない。

## 管理者導線

- 進捗: `/admin/general-monitors/quality-review`
- 有効なBatchへ、異なるモニターをReviewer A/Bとして割り当てる。
- 管理画面は確定件数、開始確認、最終送信だけを表示し、回答payloadを読み込まない。

## 保存契約

- `cloud_monitor_quality_review_batches`: 権利確認者と確認日時、元package SHA-256、期間、状態。
- `cloud_monitor_quality_review_cases`: 中立case ID、表示順、許可欠陥分類、非公開Storage path、画像SHA-256と寸法。
- `cloud_monitor_quality_review_assignments`: Reviewer A/B、同意、進捗。同じBatchで同一人物をA/Bへ割り当てられない。
- `cloud_monitor_quality_review_responses`: Reviewerごとの下書き／確定回答。既存`mangai-human-review-v2` recordと同じ判定規則をapplicationで検査する。
- 4テーブルはauthenticatedへの直接権限を持たない。本人限定Security Definer RPCだけが同意、保存、最終送信を受け付ける。

## 画像保護

- private bucket `manga-quality-review`を使用する。
- 画像APIは、ログイン、一般モニター有効状態、専用Feature Flag、本人assignment、case所属を毎回確認する。
- 画像URLは120秒の署名URLで、公開URLは作成しない。
- Prompt、Provider／model、source group／family、split、顧客情報、内部URL、秘密値を保存しない。

## 有効化条件

1. migration `202608180001_cloud_monitor_quality_review`をstagingでroundtrip確認する。
2. 人間による権利確認が全件完了した専用画像だけをprivate bucketへ登録する。
3. 元package SHA-256、画像SHA-256、寸法、case setを照合する。
4. Batchを`active`にし、異なるモニターをA/Bへ割り当てる。
5. `CLOUD_GENERAL_MONITOR_BETA_ENABLED=true`に加え、`MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=true`を対象環境だけへ設定する。
6. 390×844相当のスマートフォンで、同意、画像表示、下書き再開、画像確定、最終送信を確認する。

権利確認が未完了のBatchは登録・有効化しない。現在のprivate Batch 01はHuman権利確認が完了するまで対象外である。

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

## staging取込

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

実取込はstaging専用環境変数だけを使用し、URLから得たproject ref、環境変数のproject ref、コマンド引数のproject refが一致する場合だけ許可する。Production project refも必須とし、stagingと一致した場合は拒否する。

```powershell
$env:MANGAI_MONITOR_REVIEW_STAGING_SUPABASE_URL = "https://STAGING_PROJECT_REF.supabase.co"
$env:MANGAI_MONITOR_REVIEW_STAGING_SERVICE_ROLE_KEY = "staging専用key"
$env:MANGAI_MONITOR_REVIEW_STAGING_PROJECT_REF = "STAGING_PROJECT_REF"
$env:MANGAI_MONITOR_REVIEW_PRODUCTION_PROJECT_REF = "PRODUCTION_PROJECT_REF"

npm run manga:benchmark:monitor-batch:admit -- `
  --package C:\private\completed-rights-review.zip `
  --batch-code batch_private_01 `
  --created-by-profile-id 00000000-0000-4000-8000-000000000000 `
  --starts-at 2026-08-20T00:00:00+09:00 `
  --expires-at 2026-09-20T00:00:00+09:00 `
  --expected-count 28 `
  --apply `
  --confirm-staging-project STAGING_PROJECT_REF
```

実取込後もBatchは`draft`で停止する。DB件数、private bucket、SHA-256を別途確認してからだけ`active`化し、異なるモニターA/Bを割り当てる。CLIは一般の`NEXT_PUBLIC_SUPABASE_URL`や`SUPABASE_SERVICE_ROLE_KEY`を読まず、Production向けapply経路を持たない。

## 停止とロールバック

- 即時停止: `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=false`として再デプロイする。既存の一般モニター制作機能には影響しない。
- 個別停止: assignmentを`revoked`、またはBatchを`paused`へ変更する。
- DB rollback: 対象環境と保存件数を確認し、回答を安全な場所へ退避した後、`supabase/rollbacks/202608180001_cloud_monitor_quality_review.sql`を実行する。
- Storageの削除は対象Batch IDの完全一致を確認して実施する。Productionで自動実行しない。

## 次工程への停止条件

- Draft PRの全CIとVercel Previewが成功する。
- staging migration roundtripとモバイル実機確認が完了する。
- 人間による権利確認が完了するまではProductionへ画像を登録しない。
- A/B回答を正式Benchmarkへ採用する前に、既存validatorでHuman response契約と独立性を再検査する。
- 責任者確認前にR4-3B Visual Judge本体へ進まない。
