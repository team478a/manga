# PR-R4-3A-11 Controlled Batch Activation

作成日: 2026-08-18
基準: `feature/manga-canvas-mvp` / PR #303 merge commit `03fe58c9fc22631d15407bf1fd82b77039bbfcb2`
Branch: `codex/feat-r4-3a11-controlled-batch-activation`

## 目的

Productionへ非公開`draft`として登録済みの`batch_private_01`を、手動SQLではなく管理者画面から検査付きで有効化できるようにする。今回のPRは有効化入口の実装までであり、ProductionのBatch状態、Reviewer割当、Feature Flag、Human回答を変更しない。

## 実装

- `/admin/general-monitors/quality-review`へBatchの有効化、停止、再開操作を追加した。
- `draft -> active`では次をfail closedで検査する。
  - 現在状態が`draft`
  - `PILOT_INTRINSIC_ONLY`
  - 元package SHA-256が64桁の小文字hex
  - 人間による権利確認者と過去の確認日時
  - 開始日時より後の終了日時、かつ未失効
  - 画像が正確に28枚
  - 既存Reviewer割当が0件
- `paused -> active`でもscope、package、権利確認、期間、28枚を再検査する。
- 状態更新は`id`と取得時の旧状態を一致条件に含め、並行操作で状態が変わった場合は更新しない。
- Feature Flag停止中でもBatch検査は可能だが、Reviewer割当ボタンは無効のままにした。有効化だけではモニター画面へ公開されない。
- Japanese error案内はApp Router側に置き、domainは判定code、infrastructureは保存だけを担当する。

## 不変条件

- Production DB／Storageの外部状態を変更していない。
- migration、schema、RPC、RLS、Storage bucket、API、URLを変更していない。
- Reviewer A/Bは0/56、正式Benchmarkは0/140のまま。
- `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED`は変更していない。
- 顧客作品、Production作品、Canvas、Provider、model、pricing、credit、retry、timeout、Scheduler、PNG／PDF、成人向け境界、Desktopを変更していない。

## 回帰検証

- 集中回帰: 4/4
- dependency／module boundary: error 0、既知warning 2件は差分外
- lint: 成功
- TypeScript: Hub／Desktop成功
- Hub: 801/801
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop accessibility: violation 0
- migration manifest／rollback: 60本
- Hub production build: 成功
- Desktop build: 成功
- RC structure preflight: 成功（外部設定と既存manual acceptanceはPending）
- `git diff --check`: 成功

## Production有効化手順（今回未実施）

1. 本PRの全CIとVercel Previewを確認し、責任者がマージする。
2. Productionの管理画面で`batch_private_01`が`draft`、28枚、割当0件であることを確認する。
3. 「Batchを検査して有効化」を1回だけ実行し、`active`を確認する。
4. Vercelで`MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=true`をProductionへ設定し、再デプロイする。
5. Reviewer AのProduction表示名を責任者が特定し、別人のReviewer Bを選ぶ。
6. 開始日時以降にA/Bを割り当て、スマートフォンで同意、画像表示、下書き再開、画像確定、最終送信を確認する。

## ロールバック

- 即時停止は管理画面の「Batchを停止」で`active -> paused`とする。
- 利用者公開は`MANGAI_MONITOR_QUALITY_REVIEW_ENABLED=false`へ戻して停止する。
- 回答開始後にassignmentや回答を削除しない。必要ならassignmentを`revoked`とし、回答を退避してから別途判断する。
- Productionでmigration rollbackやStorage削除を自動実行しない。

## 停止条件

- Draft PR、Core quality、Migration roundtrip、Windows build、Vercel、Preview Commentsの成功を確認して停止する。
- 責任者確認前にProductionのBatch有効化、Feature Flag変更、A/B割当、R4-3B Visual Judgeへ進まない。
