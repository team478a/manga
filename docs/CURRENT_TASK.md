# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-26
- 状態: `READY_FOR_REVIEW`（統合完了、`feature/manga-canvas-mvp`へのmergeは責任者判断待ち）
- リポジトリ: `team478a/manga`
- 作業ブランチ: `integration/maintenance-stack-20260726`
- 統合元デフォルトブランチ: `feature/manga-canvas-mvp`
- 統合開始コミット: `c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`
- 統合後HEAD: `a58dc66`
- 詳細記録: [`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)

## 現在の目的

保守性改善Draft PR #14〜#28（stacked、`handoff/codex-to-claude-20260725`系統）を、`feature/manga-canvas-mvp`の最新状態（PR #30〜#32: Vercel workspace package build修正、パスワード確認・再設定フロー、Creatorプロフィール・作品アップロードの安全性強化）を失わずに統合し、デザイン実装（`design/mangai-ui-refresh`、PR #33）が着手できる新しい基準ブランチを用意すること。

## 完了済み

- [x] `design/mangai-ui-refresh`の作業状態を確認し中断（`docs/design/`配下の文書のみ、未commit差分なし）
- [x] `feature/manga-canvas-mvp`を`git pull --ff-only`で最新化し、`integration/maintenance-stack-20260726`を作成
- [x] PR #14〜#28（15コミット）を古い順に1コミットずつ`git cherry-pick`
- [x] 競合3件（PR #19: `src/app/actions.ts`、PR #20: `package.json`、PR #27: `src/app/actions/{auth,profile,work}-actions.ts`）を解決
  - 分割構造（薄い互換entrypoint + 機能別ファイル）を採用
  - PR #31/#32由来のパスワード確認・作品アップロード安全性強化を該当する機能別ファイルへ移設
  - `package.json`はDesktop込みroot typecheckと`deps:check`の両方を維持
- [x] 依存関係インストール（root/apps/desktop/packages/canvas-core/packages/ai-core）、`build:packages`
- [x] 必須品質ゲートをすべて実行（詳細は下表）
- [x] `docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`作成
- [x] 本ファイル・`docs/HANDOFF_LOG.md`更新

## 品質ゲート結果（2026-07-26、`integration/maintenance-stack-20260726` @ `a58dc66`）

| 項目 | 結果 |
| --- | --- |
| `npm run deps:check` | PASS（5 packages, 21 source files, 違反0件） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run hub:test` | PASS（116/116） |
| `npm run canvas:test` | PASS（26/26） |
| `npm run ai:test` | PASS（44/44） |
| `npm run desktop:test` | PASS（98/98） |
| `npm run desktop:test:a11y` | **BLOCKED_EXTERNAL_ENVIRONMENT**（本環境にXサーバーがなくElectron起動不可） |
| `npm run db:migrations:validate` | PASS（16件） |
| `npm run build`（Hub） | PASS |
| `npm run desktop:build` | PASS |
| `npm run rc:preflight` | PASS（構造チェック、外部サービス設定はPENDING） |
| `git diff --check` | PASS |

詳細な競合解決内容、PR #30〜#32からの維持機能、セキュリティ確認は統合記録文書を参照。

## 未完了・次の作業

1. **Draft PR作成**（本タスクの一部、次に実施）: `integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`
2. 責任者によるDraft PRレビュー・承認
3. 承認後、`feature/manga-canvas-mvp`へのmerge（本タスクでは実施しない）
4. merge後、`design/mangai-ui-refresh`（PR #33）のビジュアル仕様承認と合わせて、新しい実装ブランチをmerge後の`feature/manga-canvas-mvp`から作成しPhase D1へ着手

## 禁止事項（本タスク中に遵守）

- `feature/manga-canvas-mvp`への直接merge・push
- PR #14〜#28の個別merge
- PR #33のmerge・rebase・base変更
- Phase D1のデザインコード実装
- force push
- 既存migrationの書き換え

上記はいずれも実施していない。

## 次担当者が最初に読むファイル

1. [`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)（統合の詳細記録）
2. 本ファイル
3. [`docs/HANDOFF_LOG.md`](HANDOFF_LOG.md)
4. Draft PR本文（作成後のURLは`docs/HANDOFF_LOG.md`に記録）
