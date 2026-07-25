# MANGAI Claude Code Instructions

このリポジトリは、一般漫画向けWeb製品`MANGAI Hub / Cloud`と、ローカル制作・成人向け制作を担当するWindows製品`MANGAI Desktop`を同一monorepoで管理しています。

Claude Codeは、Codexの会話を推測せず、GitHub上の引継ぎ文書と差分を読んで作業を継続してください。

## 作業開始手順

最初に以下を順番に読んでください。

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/CURRENT_TASK.md`
4. `docs/REMAINING_TASKS.md`
5. `docs/PROJECT_STATUS_AND_ROADMAP.md`
6. `docs/IMPLEMENTATION_HISTORY.md`

その後、必ず次を確認してください。

```bash
git status --short
git branch --show-current
git log --oneline --decorate -25
git diff feature/manga-canvas-mvp...HEAD --stat
git diff feature/manga-canvas-mvp...HEAD -- docs/REMAINING_TASKS.md
```

## 現在のブランチ構造

- デフォルトブランチ: `feature/manga-canvas-mvp`
- Codex最新作業ブランチ: `codex/pr-23-hub-structured-logging`
- Claude Code引継ぎブランチ: `handoff/codex-to-claude-20260725`
- 引継ぎ元head: `0910919e37904245b80e26e4c495893da6234a9e`

引継ぎブランチには、デフォルトブランチより15コミット先行したstacked Draft PRの変更が含まれます。過去の変更を最初から再実装しないでください。

## 現在の優先事項

`docs/REMAINING_TASKS.md`に記載されている通り、2026-07-24時点で保守性改善PR-01〜PR-23の実装は完了しています。次の優先事項は以下です。

1. stacked Draft PR #14〜#28の内容・依存順・CI状態を確認する。
2. 各PRを古い順にレビュー可能な状態へ整える。
3. CIが成功し、base関係が正しいものだけを順番に統合する。
4. 本番hosting未決定のlog sink、alert通知先、保持期間はコードで推測実装しない。
5. 新機能へ進む場合は、責任者が指定したIssueまたは`docs/CURRENT_TASK.md`の範囲に限定する。

## 変更時の注意

- `feature/manga-canvas-mvp`へ直接pushしない。
- stacked PRのbaseを一括変更しない。
- 自動rebase、force push、履歴の書き換えを行わない。
- API response body、DB schema、Storage path、Stripe metadata、Desktop IPC、backup形式を無断変更しない。
- `MangaiDatabase`、`service.ts`、`actions.ts`等の薄い互換entrypointを、利用箇所確認なしに削除しない。
- `src/lib/domain-errors.ts`とAPI Error契約を維持し、未知例外の生messageを利用者へ返さない。
- `src/lib/hub-logger.ts`へPrompt、画像、メール、token、秘密値を追加しない。
- ローカル生成、外部Provider、成人向け処理の安全境界を緩和しない。

## 検証

変更対象に応じて最低限以下を実行してください。

```bash
npm install
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run db:migrations:validate
```

HubまたはDesktopの製品コードを変更した場合は、それぞれのbuildも実行します。

```bash
npm run build
npm run desktop:build
```

Windows実機、Ollama、ComfyUI、Dezgo実API、Supabase staging、Stripe Webhook等が必要な試験は、環境がない状態で成功扱いにしないでください。`BLOCKED_EXTERNAL_ENVIRONMENT`として具体的に記録します。

## 作業終了・Codexへ戻す手順

1. `docs/CURRENT_TASK.md`のチェック項目、現在位置、テスト結果を更新する。
2. `docs/HANDOFF_LOG.md`へ新しい記録を追記する。
3. `git diff --check`を実行する。
4. 変更を小さな単位でcommitする。
5. 現在のブランチへpushする。
6. 次の担当者が最初に実行するコマンドと対象ファイルを明記する。

Codexへ戻す場合も、会話要約ではなくGitHub上の上記2文書を正本にしてください。
