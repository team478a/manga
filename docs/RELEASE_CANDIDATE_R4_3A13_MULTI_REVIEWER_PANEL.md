# PR-R4-3A-13 Multi-Reviewer Panel Release Candidate

## 判定

`READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PRODUCTION_UNCHANGED`

## 基準と範囲

- Base: PR #305 merge commit `8ae9beaa334c0621f80fc30d72527a7a031bfa8e`
- Branch: `codex/feat-r4-3a13-multi-reviewer-panel`
- 目的: 権利確認済みBenchmark画像を、異なる複数モニターが独立判定できるようにする。
- 既定5名、Batch単位で2〜9名。Primary Reviewer A/Bは既存の正式Benchmark v2契約を維持し、Panel Reviewer C〜Iは`mangai-human-review-panel-v1`として分離する。

## 安全境界

- 同じBatchの同一プロフィール重複、同一slot重複を既存unique制約で拒否する。
- 目標人数を超えるslotはapplication検査とDB triggerの両方で拒否する。
- rollbackはC〜Iのassignmentが存在する場合、データを削除せず停止する。
- 管理一覧は進捗だけを取得し、回答payload、正解label、AI監査を取得しない。
- private Storage、120秒署名URL、本人限定RPC、Feature Flagの既存契約は変更しない。

## Production状態

- `batch_private_01`: `active`、画像28枚、assignment 0、response 0。
- `MANGAI_MONITOR_QUALITY_REVIEW_ENABLED`: off。
- 今回はmigration適用、Feature Flag変更、担当割当、Human Reviewを実施していない。
- Production作品、Canvas、Provider、credit、Storage object、API、URL、PNG／PDF、成人向け境界、Desktopは変更していない。

## 検証

- 集中回帰: 17/17成功。
- Hub型検査: 成功。
- lint: 成功。
- migration manifest: 61件、forward／rollback検証成功。
- dependency／module boundary: error 0。既知warning 2件は差分外。
- Hub: 806/806、Canvas: 26/26、AI: 48/48、Desktop: 182/182成功。
- Desktop accessibility: violation 0（既知の要手動contrast確認のみ）。
- Hub／Desktop production build: 成功。
- RC preflight: structure ready。外部環境と既存manual acceptanceはPending。
- `git diff --check`: 成功。
- Draft PR [#306](https://github.com/team478a/manga/pull/306): Draft／MERGEABLE。
- 初回HEAD `252fe55`のCore quality、Migration roundtrip、Windows build、Vercel、Preview Comments: すべて成功。
- Vercel Preview: [Ready](https://mangai-hub-staging-git-codex-feat-r4-57ac78-team478as-projects.vercel.app)。

## 適用・ロールバック順序

1. Draft PRの全CIとVercel Preview成功を確認する。
2. 責任者確認後にmigration `202608180002_cloud_monitor_quality_review_panel`を適用する。
3. 管理画面で既存Batchが目標5名、割当0名と表示されることを確認する。
4. 別工程でFeature Flagを有効化し、異なる5名をA〜Eへ割り当てる。
5. 緊急停止はFeature Flag offまたはBatch pause。migration rollbackはC〜I割当が0件のときだけ実行する。

## 停止条件

- Draft PR、全CI、Vercel Previewを確認した時点で停止する。
- 責任者確認前にProduction migration、Feature Flag、担当割当、R4-3B Visual Judgeへ進まない。
