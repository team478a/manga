# Staging durable export 1 Project受入れrunbook

> 2026-08-27に全項目合格し、隔離環境のcleanupまで完了した。結果は`RELEASE_CANDIDATE_STAGING_DURABLE_EXPORT_ACCEPTANCE_CLOSEOUT_20260827.md`を正本とする。

## 目的と範囲

初期ユーザー向け最後の外部gateとして、stagingの固定一般向けProject 1件でPDF、連番PNG ZIP、Project JSONを検証する。Production、外部画像Provider、credit、利用者実データは使用しない。

## 実行前の停止条件

- `MANGAI_DB_ENV=staging`でない、または`MANGAI_STAGING_PROJECT_REF`と`PGHOST`／`PGUSER`が一致しない。
- `npm run db:staging:preflight`、`npm run cloud:export:preflight`のいずれかが失敗する。
- remote migration一覧に想定外のdriftがある、または`202608260002_cloud_durable_export_formats`を安全に適用できない。
- queueに既存の待機中／実行中Export Jobがある。
- owner A／非owner B、確定済み固定Project、期待ページ順を一意に確認できない。

該当時はmigration、Flag、Worker、Job、Storageを変更せず停止する。秘密値、署名URL、Storage path、利用者素材は証跡へ残さない。

## 手順

1. remote migration一覧を読み取り、未適用migrationと順序を記録する。
2. manifest順に未適用migrationだけをstagingへ適用し、schema／RLS／RPCを検査する。
3. `MANGAI_CLOUD_DURABLE_EXPORT_FORMATS_ENABLED=true`をstaging Previewだけで一時的に有効化する。
4. owner Aの固定一般向けProject 1件でPDF Jobを作成し、4ページsegment完了後に一時停止する。
5. 同じJobを再開し、完了済みsegmentを作り直さずPDFを完成させる。
6. 同じProjectでPNG ZIP、Project JSONを各1 Jobだけ実行する。自動retryや重複送信は行わない。
7. owner Aが各署名URLを取得でき、owner Bは履歴参照、状態変更、downloadを拒否されることを確認する。
8. PDFページ順、ZIPの連番PNG・寸法・件数、Project JSONのschema version・ページ順・文字layerを確認する。
9. 一時segmentと失敗時Storageのcleanup、queue 0件、active Job 0件を確認する。
10. `MANGAI_CLOUD_DURABLE_EXPORT_FORMATS_ENABLED`を既定OFFへ戻し、Preview表示がPDF互換状態へ戻ることを確認する。

## 合格条件

- 中断再開で完了済みsegmentを再作成せず、3形式が各1件だけ完成する。
- owner Aだけが短時間署名URLを取得でき、owner Bはfail closedとなる。
- 出力順、寸法、manifest／schema、文字layerがrepository fixtureと一致する。
- cleanup完了、queue 0、active Job 0、Flag既定OFF復元を確認できる。

全項目成功後にだけ、初期ユーザー向け7条件を7/7として再判定する。Production適用やProduction BFL受入れは別runbook・別判定とする。
