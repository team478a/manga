# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-26
- 状態: `READY_FOR_REVIEW`（統合完了、Draft PR #34作成済み、`feature/manga-canvas-mvp`へのmergeは責任者判断待ち）
- リポジトリ: `team478a/manga`
- 作業ブランチ: `integration/maintenance-stack-20260726`
- Base: `feature/manga-canvas-mvp` @ `c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`
- Code integration HEAD: `a58dc66`（保守性改善PR #14〜#28のcherry-pick完了時点。コード変更はここまで）
- Final branch HEAD before this correction: `43cee0f1f42d4c68e697559aa0422b9e3fd9c418`（`a58dc66`に統合記録・引継ぎ文書を追加した時点。コード変更なし、文書追加のみ）
- Draft PR: **#34**（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`）
- PR state: Draft / mergeable
- Changed files: 139 files（`feature/manga-canvas-mvp`との比較）
- 詳細記録: [`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)

## 現在の目的

保守性改善Draft PR #14〜#28（stacked、`handoff/codex-to-claude-20260725`系統）を、`feature/manga-canvas-mvp`の最新状態（PR #30〜#32: Vercel workspace package build修正、パスワード確認・再設定フロー、Creatorプロフィール・作品アップロードの安全性強化）を失わずに統合し、デザイン実装（`design/mangai-ui-refresh`、PR #33）が着手できる新しい基準ブランチを用意すること。

## 完了済み

- [x] `design/mangai-ui-refresh`の作業状態を確認し中断（`docs/design/`配下の文書のみ、未commit差分なし）
- [x] `feature/manga-canvas-mvp`を`git pull --ff-only`で最新化し、`integration/maintenance-stack-20260726`を作成
- [x] PR #14〜#28（15コミット）を古い順に1コミットずつ`git cherry-pick`（コード統合HEAD: `a58dc66`）
- [x] 競合3件（PR #19: `src/app/actions.ts`、PR #20: `package.json`、PR #27: `src/app/actions/{auth,profile,work}-actions.ts`）を解決
  - 分割構造（薄い互換entrypoint + 機能別ファイル）を採用
  - PR #31/#32由来のパスワード確認・作品アップロード安全性強化を該当する機能別ファイルへ移設
  - `package.json`はDesktop込みroot typecheckと`deps:check`の両方を維持
- [x] 依存関係インストール（root/apps/desktop/packages/canvas-core/packages/ai-core）、`build:packages`
- [x] 必須品質ゲートをすべて実行（詳細は下表）
- [x] `docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`、`docs/CURRENT_TASK.md`、`docs/HANDOFF_LOG.md`を作成
- [x] **Draft PR #34を作成済み**（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`）
- [x] PR #34のCI確認: Required Quality PASS、Migration roundtrip PASS、Desktop Windows PASS（Accessibility testsを含む）、Vercel Preview Ready
- [x] AGENTS.md、CLAUDE.md、docs/AI_HANDOFF.mdを現在の統合後状態に合わせて追加（PR #29の内容をそのまま流用せず書き直し）

## 品質ゲート結果（2026-07-26、`integration/maintenance-stack-20260726` @ `43cee0f`時点でローカル実行）

| 項目 | 結果 |
| --- | --- |
| `npm run deps:check` | PASS（5 packages, 21 source files, 違反0件） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run hub:test` | PASS（116/116） |
| `npm run canvas:test` | PASS（26/26） |
| `npm run ai:test` | PASS（44/44） |
| `npm run desktop:test` | PASS（98/98） |
| `npm run desktop:test:a11y`（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT（本コンテナにXサーバーがなくElectron起動不可） |
| `npm run test:a11y`（GitHub Actions Desktop Windows workflow） | **PASS**（Windowsランナー上で実行・成功。Accessibility全体をBLOCKED扱いにしない） |
| `npm run db:migrations:validate` | PASS（16件） |
| `npm run build`（Hub） | PASS |
| `npm run desktop:build` | PASS |
| `npm run rc:preflight` | PASS（構造チェック、外部サービス設定はPENDING） |
| `git diff --check` | PASS |

PR #34のCI（`43cee0f`時点）: Required Quality PASS、Migration roundtrip PASS、Desktop Windows PASS、Vercel Preview deployment Ready（状態`success`、"Deployment has completed"）。

詳細な競合解決内容、PR #30〜#32からの維持機能、セキュリティ確認は統合記録文書を参照。

## 未完了・次の作業

1. 責任者によるDraft PR #34のレビュー・承認
2. 承認後、`feature/manga-canvas-mvp`へのmerge（本タスクでは実施しない）
3. merge後、`design/mangai-ui-refresh`（PR #33）のビジュアル仕様承認と合わせて、新しい実装ブランチをmerge後の`feature/manga-canvas-mvp`から作成しPhase D1へ着手
4. Vercel本番環境での通し受入れ（Vercel Previewとは別項目、BLOCKED_EXTERNAL_ENVIRONMENT）

## 禁止事項（本タスク中に遵守）

- `feature/manga-canvas-mvp`への直接merge・push
- PR #14〜#28の個別merge・close
- PR #33のmerge・rebase・base変更
- PR #34のmerge
- Phase D1のデザインコード実装
- force push
- 既存migrationの書き換え

上記はいずれも実施していない。

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル（`docs/CURRENT_TASK.md`）
5. [`docs/HANDOFF_LOG.md`](HANDOFF_LOG.md)
6. [`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)（統合の詳細記録）
7. 対象機能の設計文書（デザイン関連なら`docs/design/`配下）
