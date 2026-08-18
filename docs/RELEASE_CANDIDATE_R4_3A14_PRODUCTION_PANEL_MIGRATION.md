# PR-R4-3A-14 Production Panel Migration Acceptance

## 判定

`PRODUCTION_MIGRATION_APPLIED / TARGET_REVIEWERS_5 / ASSIGNMENTS_0 / RESPONSES_0 / FEATURE_FLAG_OFF`

## 基準と範囲

- Base: PR #306 merge commit `a390091d590146b7a3f2496763ac2c0118e453ce`
- Branch: `codex/docs-r4-3a14-production-panel-migration`
- 対象: PR-R4-3A-13で実装済みのmigration `202608180002_cloud_monitor_quality_review_panel`をProductionへ適用し、既存Batchの安全状態を検証する。
- 今回のGit差分は証跡文書だけとし、application code、migration、RPC、Storage、API、URL、Feature Flag、Provider、credit、作品、Canvasを変更しない。

## Production適用

- 対象project ref: `vmdsyxykcrgxcdbrwlkv`。
- 事前検査: Benchmarkテーブルあり、`target_reviewer_count`なし、assignment 0、response 0。
- 既存Batch: `batch_private_01`、`active`、`PILOT_INTRINSIC_ONLY`、画像28枚、assignment 0。
- Supabase SQL Editorから、リポジトリ内のmigration SQLを改変せず1回だけ実行した。
- 実行結果: `Success. No rows returned`。

## 適用後のDB検証

- `batch_private_01`: `active`。
- `review_scope`: `PILOT_INTRINSIC_ONLY`。
- `target_reviewer_count`: 5。
- case: 28。
- assignment: 0。
- response: 0。
- `enforce_cloud_monitor_quality_review_panel_slot()`: 存在。
- `cloud_monitor_quality_review_assignments_panel_slot` trigger: 存在。
- `authenticated`の保護関数直接実行権限: なし。

## 不変条件

- `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED`はoffのまま。
- モニターA〜Eを含む担当割当は作成していない。
- Human Review回答は作成していない。正式Benchmarkは引き続き0/140。
- Production作品、Canvas、Storage object、Provider、model、pricing、credit、retry、timeout、Scheduler、API、URL、PNG／PDF、成人向け境界、Desktopは変更していない。
- Production管理画面の新規タブは認証セッションが共有されずログイン画面へ遷移したため、画面表示確認は次工程へ持ち越した。DBの受入れ条件はSQLで確認済み。

## ロールバック

- 緊急停止はFeature Flag offを維持するか、Batchをpauseする。現在はFlag off、assignment 0のためモニター公開されていない。
- migration rollbackは`supabase/rollbacks/202608180002_cloud_monitor_quality_review_panel.sql`を使用する。
- rollbackはPanel C〜Iのassignmentが存在する場合にデータを削除せずfail closedで停止する。現在のassignmentは0件。

## 検証

- Production DB事前／事後SQL検査: 成功。
- dependency／module boundary: error 0。既知warning 2件は差分外。
- lint、Hub／Desktop型検査: 成功。
- Hub: 806/806、Canvas: 26/26、AI: 48/48、Desktop: 182/182成功。
- Desktop accessibility: violation 0。既知の要手動contrast確認だけがincomplete。
- migration manifest: 61件、forward／rollback検証成功。
- Hub／Desktop production build: 成功。
- RC preflight: structure ready。外部環境と既存manual acceptanceはPending。
- `git diff --check`: 成功。
- Draft PR、GitHub CI、Vercel Preview: 初回commit後に追記する。

## 停止条件

- Draft PR、全CI、Vercel Previewを確認した時点で停止する。
- 責任者確認とProduction管理画面の表示確認前にFeature Flagを有効化せず、モニター割当、Human Review、R4-3B Visual Judgeへ進まない。
