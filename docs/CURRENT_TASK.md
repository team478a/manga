# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-25
- 状態: `READY_FOR_CLAUDE_CODE`
- リポジトリ: `team478a/manga`
- 作業ブランチ: `handoff/codex-to-claude-20260725`
- 引継ぎ元: Codex
- 次担当: Claude Code
- 引継ぎ元コミット: `0910919e37904245b80e26e4c495893da6234a9e`
- デフォルト基準: `feature/manga-canvas-mvp@27d678bfbae2be0f8fc69b165b3532748a3bcaee`

## 現在の目的

Codexが完了した保守性改善PR stackをClaude Codeが安全に引き継ぎ、会話履歴なしで次の作業へ進める状態を維持する。

現時点では新機能実装よりも、Draft PR #14〜#28の整合確認、品質ゲート再確認、順次統合準備を優先する。

## 完了済み

- [x] 最新Codex branchを特定
- [x] 最新headがデフォルトより15コミット先行、behind 0であることを確認
- [x] `handoff/codex-to-claude-20260725`を最新headから作成
- [x] `AGENTS.md`を追加
- [x] `CLAUDE.md`を追加
- [x] `docs/AI_HANDOFF.md`を追加
- [x] 現在タスク、禁止事項、再開コマンドを文書化
- [x] 保守性改善PR #14〜#28の対応関係を文書化
- [x] 外部環境待ち項目を文書化

## 次に実施する作業

### Task 1: 引継ぎbranchのローカル確認

```bash
git fetch origin
git checkout handoff/codex-to-claude-20260725
git pull origin handoff/codex-to-claude-20260725
npm install
```

確認:

```bash
git status --short
git log --oneline --decorate -25
git diff feature/manga-canvas-mvp...HEAD --stat
```

### Task 2: 品質ゲートの再実行

```bash
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run db:migrations:validate
npm run build
npm run desktop:build
git diff --check
```

結果を下の「検証結果」へ記録する。

### Task 3: stacked Draft PRの整合確認

古い順に確認する。

```text
#14 → #15 → #16 → #17 → #18 → #19 → #20 →
#21 → #22 → #23 → #24 → #25 → #26 → #27 → #28
```

各PRで確認すること:

- baseが直前PRのheadを指しているか
- mergeableか
- CIが成功しているか
- PR本文の検証件数が実際のbranchと一致するか
- 互換entrypointが残っているか
- migration履歴、API契約、Desktop IPC、backup形式を壊していないか
- 秘密値、Prompt、画像、個人情報がlog・errorへ露出していないか

### Task 4: 統合方針の確定

責任者の明示指示を得た後、以下のどちらかを選択する。

- 方針A: #14から#28までstacked順にmerge
- 方針B: 最終branchを新しい統合PRとしてデフォルトへまとめる

現時点ではmerge、rebase、squash、force pushを実行しない。

## 完了条件

- [ ] 引継ぎbranchで依存関係をinstallできる
- [ ] ローカルで実行可能な品質ゲートが成功する
- [ ] 実行不能項目は環境とerrorを記録する
- [ ] PR #14〜#28のbase/head/CI/mergeabilityを一覧化する
- [ ] 統合時の問題候補を列挙する
- [ ] 責任者がmerge方式を判断できる状態にする
- [ ] 作業終了時に`docs/HANDOFF_LOG.md`へ追記する

## 現在の検証結果

この引継ぎ作成はGitHub connector経由の文書追加のみであり、ローカルcheckoutは使用していない。

| 検証 | 状態 | 備考 |
| --- | --- | --- |
| branch作成 | PASS | `0910919`から作成 |
| デフォルトとの差分 | PASS | ahead 15 / behind 0 |
| Hub test | NOT_RUN_THIS_HANDOFF | PR #28記録は110/110 |
| Canvas core | NOT_RUN_THIS_HANDOFF | PR #28記録は26/26 |
| AI core | NOT_RUN_THIS_HANDOFF | PR #28記録は44/44 |
| Desktop integration | NOT_RUN_THIS_HANDOFF | PR #28記録は98/98 |
| TypeScript | NOT_RUN_THIS_HANDOFF | PR #28では成功記録 |
| ESLint | NOT_RUN_THIS_HANDOFF | PR #28では成功記録 |
| Hub build | NOT_RUN_THIS_HANDOFF | Claude Code環境で再確認 |
| Desktop build | NOT_RUN_THIS_HANDOFF | Claude Code環境で再確認 |

## 未決事項

1. PR #14〜#28を個別mergeするか、最終branchから統合PRを作るか。
2. HostingをVercel中心にするか、別のlog sinkを採用するか。
3. Structured Loggingの保持期間、通知先、一次対応者。
4. Supabase staging、Stripe test、Windows署名、実AI環境の提供時期。

## 禁止事項

- デフォルトブランチへの直接push
- PR stackの無断merge
- 一括rebase、squash、force push
- 既存migrationの変更・削除
- 既存互換entrypointの無断削除
- API response、DB、Storage、Desktop IPC、backup形式の無断破壊
- 外部Provider制限、成人向けローカル優先、fail-closed条件の緩和
- 秘密情報、Prompt、画像、個人情報のcommit・log出力

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. このファイル
5. `docs/REMAINING_TASKS.md`
6. `docs/PROJECT_STATUS_AND_ROADMAP.md`
7. `docs/IMPLEMENTATION_HISTORY.md`
