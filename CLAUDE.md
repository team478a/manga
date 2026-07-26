# MANGAI Claude Code Instructions

このリポジトリは、一般漫画向けWeb製品`MANGAI Hub / Cloud`と、ローカル制作・成人向け制作を担当するWindows製品`MANGAI Desktop`を同一monorepoで管理しています。

Claude Codeは、Codexの会話を推測せず、GitHub上の引継ぎ文書と差分を読んで作業を継続してください。

## 作業開始手順

最初に以下を順番に読んでください。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. `docs/CURRENT_TASK.md`
5. `docs/HANDOFF_LOG.md`
6. 対象機能の設計文書（Canvas/Desktop UIなら`docs/design/`、Hub一般なら`docs/hub/`、Desktop機能なら`docs/desktop/`配下）

その後、必ず次を確認してください。

```bash
git status --short
git branch --show-current
git log --oneline --decorate -25
git diff feature/manga-canvas-mvp...HEAD --stat
```

## 現在のブランチ構造（2026-07-26更新）

- デフォルトブランチ: `feature/manga-canvas-mvp`
- 保守性改善統合ブランチ: `integration/maintenance-stack-20260726`（Draft PR **#34**、base=`feature/manga-canvas-mvp`@`c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`）
- デザイン仕様ブランチ: `design/mangai-ui-refresh`（Draft PR **#33**、base=`handoff/codex-to-claude-20260725`、文書のみ）
- PR #14〜#28（元のstacked Draft PR）はPR #34への統合の元データとして残存。個別にmerge・rebase・closeしていない

PR #34は、保守性改善PR #14〜#28をデフォルトブランチの最新状態（PR #30〜#32: Vercel workspace package build修正、パスワード確認・再設定フロー、Creatorプロフィール・作品アップロード安全性強化）と統合したものです。統合の詳細・競合解決内容は`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`を参照してください。

**削除済みの古い前提**（参照しないこと）: 「`codex/pr-23-hub-structured-logging`が最新作業ブランチ」「`handoff/codex-to-claude-20260725`が現在の基点」「デフォルトより15コミット先行」「PR #14〜#28をこれから確認する」。

## 現在の優先事項

1. PR #34の責任者レビュー・マージ判断を待つ。
2. PR #34が`feature/manga-canvas-mvp`へmergeされたら、`design/mangai-ui-refresh`（PR #33、`docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`）のビジュアル仕様承認と合わせて、merge後の最新`feature/manga-canvas-mvp`から新しい実装ブランチを作成し、Phase D1（デザイントークン導入）へ着手する。
3. 本番hosting未決定のlog sink、alert通知先、保持期間はコードで推測実装しない。
4. 新機能へ進む場合は、責任者が指定したIssueまたは`docs/CURRENT_TASK.md`の範囲に限定する。

## 変更時の注意

- `feature/manga-canvas-mvp`へ直接pushしない。
- PR #34、PR #33を無断でrebase、squash、force push、base変更、mergeしない。
- 自動rebase、force push、履歴の書き換えを行わない。
- API response body、DB schema、Storage path、Stripe metadata、Desktop IPC、backup形式を無断変更しない。
- `MangaiDatabase`、`service.ts`、`actions.ts`等の薄い互換entrypointを、利用箇所確認なしに削除しない。
- `src/lib/domain-errors.ts`とAPI Error契約を維持し、未知例外の生messageを利用者へ返さない。
- `src/lib/hub-logger.ts`へPrompt、画像、メール、token、秘密値を追加しない。
- ローカル生成、外部Provider、成人向け処理の安全境界を緩和しない。
- `design/mangai-ui-refresh`（PR #33）ではUIコード・CSS・Reactコンポーネントを変更しない。デザイン実装はPhase D1着手条件（PR #34 merge＋ビジュアル仕様承認）が揃ってから新しい実装ブランチで行う。

## 検証

変更対象に応じて最低限以下を実行してください。

```bash
npm install
npm run deps:check
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run desktop:test:a11y
npm run db:migrations:validate
```

HubまたはDesktopの製品コードを変更した場合は、それぞれのbuildも実行します。

```bash
npm run build
npm run desktop:build
npm run rc:preflight
```

`desktop:test:a11y`はローカルにXサーバーがない環境では`LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT`として記録し、GitHub ActionsのDesktop Windows workflow（Windowsランナー上で`npm run test:a11y`を実行）の結果と合わせて判断する。Accessibility全体をBLOCKED扱いにしない。

Windows実機、Ollama、ComfyUI、Dezgo実API、Supabase staging、Stripe Webhook、Vercel本番環境等が必要な試験は、環境がない状態で成功扱いにしないでください。`BLOCKED_EXTERNAL_ENVIRONMENT`として具体的に記録します。Vercel Previewデプロイ（GitHub Actions/Vercel連携で自動実行されるもの）はCI結果として確認可能なため、これとVercel本番環境の通し受入れは区別して記録してください。

## 作業終了・引継ぎ手順

1. `docs/CURRENT_TASK.md`のチェック項目、現在位置、テスト結果を更新する。
2. `docs/HANDOFF_LOG.md`へ新しい記録を追記する。
3. `git diff --check`を実行する。
4. 変更を小さな単位でcommitする。
5. 現在のブランチへpushする。
6. 次の担当者が最初に実行するコマンドと対象ファイルを明記する。

Codex・Claude Codeどちらへ引き継ぐ場合も、会話要約ではなくGitHub上の`docs/AI_HANDOFF.md`・`docs/CURRENT_TASK.md`・`docs/HANDOFF_LOG.md`を正本にしてください。
