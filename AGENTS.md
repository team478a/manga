# MANGAI Agent Instructions

このファイルはCodexとClaude Code共通の作業規約です。会話履歴ではなく、GitHub上のコード・文書・コミットを正本として扱ってください。

## 最初に確認する順番

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. `docs/CURRENT_TASK.md`
5. `docs/HANDOFF_LOG.md`
6. 対象機能の設計文書（例: Canvas関連なら`docs/desktop/`、Hub UIなら`docs/design/`、Hub一般なら`docs/hub/`配下）

## 作業開始時の必須確認

```bash
git status --short
git branch --show-current
git log --oneline --decorate -15
git diff feature/manga-canvas-mvp...HEAD --stat
```

## 現在の基点（2026-07-26更新）

- デフォルトブランチ: `feature/manga-canvas-mvp`
- 保守性改善統合ブランチ: `integration/maintenance-stack-20260726`（Draft PR **#34**、レビュー・マージ判断待ち。PR #14〜#28のstacked構造を古い順にcherry-pickし、`feature/manga-canvas-mvp`側のPR #30〜#32由来機能（Vercel workspace package build修正、パスワード確認・再設定フロー、Creatorプロフィール・作品アップロード安全性強化）と統合済み）
- デザイン仕様ブランチ: `design/mangai-ui-refresh`（Draft PR **#33**、文書のみ。「MANGAI Creative Studio」コンセプトのビジュアル仕様、責任者の方向性承認済み・画面別の詳細承認は未了）
- PR #14〜#28（元のstacked Draft PR）はPR #34への統合作業の元データとして残存。個別にmerge・rebase・closeしていない
- 詳細は`docs/CURRENT_TASK.md`と`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`を参照

**古い前提を使わないこと**: 「`codex/pr-23-hub-structured-logging`が最新作業ブランチ」「`handoff/codex-to-claude-20260725`が現在の基点」「デフォルトより15コミット先行」「PR #14〜#28をこれから確認する」は、いずれも2026-07-26時点で解消済みの過去の状態です。参照しないでください。

## 基本ルール

- `docs/CURRENT_TASK.md`に記載された範囲だけを進める。
- 完了済みの実装を別方式で作り直さない。
- 既存API、DB、Storage、Desktop IPC、保存形式の後方互換を壊さない。
- 大規模な一括変更を避け、レビュー可能な単位でコミットする。
- 新しい仕様判断が必要な場合は、実装で先回りせず`docs/CURRENT_TASK.md`の未決事項へ記録する。
- `.env*`、APIキー、署名鍵、認証情報、利用者コンテンツをコミットしない。
- OpenAI、Grok、Resendなど外部ProviderのAPIキーは、管理者画面で入力・保存・差し替えできる構造を標準とする。Supabase Vaultへ保存し、保存後は画面・通常テーブル・監査ログへ本体や末尾文字を再表示しない。保存完了時は明示的な追加操作なしで利用可能にする。Supabase URL・service role、Stripe webhook secret、署名鍵など基盤秘密情報は対象外で、デプロイ環境変数または専用Secret Storeを使う。
- Prompt、画像、成人向けコンテンツ、個人情報をログへ出力しない。
- 外部AI Providerへの送信は既存の明示承認、分類、費用上限、fail-closed方針を維持する。
- 成人向け処理はローカル優先を維持し、明示承認なしに外部送信経路を有効化しない。
- Supabase migrationの既存履歴を変更・削除しない。追加時は冪等性、checksum、rollbackを確認する。
- PR #34、PR #33を無断でrebase、squash、base変更、mergeしない。
- CodexとClaude Codeが同じブランチを同時編集しない。
- `design/mangai-ui-refresh`（PR #33）ではUIコード・CSS・Reactコンポーネントを変更しない（文書のみ）。デザイン実装は、PR #34のmergeとPR #33のビジュアル仕様承認の両方が揃ってから、merge後の`feature/manga-canvas-mvp`上に新しい実装ブランチを作成して開始する。

## 品質ゲート

変更範囲に応じて以下を実行し、結果を`docs/CURRENT_TASK.md`と`docs/HANDOFF_LOG.md`へ記録してください。

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
npm run build
npm run desktop:build
npm run rc:preflight
git diff --check
```

`desktop:test:a11y`はローカル環境にXサーバー（ディスプレイ）がない場合`LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT`として記録し、GitHub ActionsのDesktop Windows workflow（`npm run test:a11y`をWindowsランナーで実行）の結果をあわせて確認する。Accessibility全体をBLOCKEDとして扱わない。

依存境界を変更した場合は、`npm run hub:test`内のdependency boundary testだけに依存せず、`scripts/check-dependency-boundaries.mjs`の結果も確認してください。

## 中断・引継ぎ時

利用上限、コンテキスト限界、環境不足などで中断する場合も、未完了状態を隠さず次を実施してください。

1. 新しい作業を開始しない。
2. `git status`と差分を確認する。
3. 完了内容、未完了内容、変更ファイル、失敗中のテストを`docs/CURRENT_TASK.md`へ記録する。
4. `docs/HANDOFF_LOG.md`へ担当AI、ブランチ、コミット、検証結果、次の一手を追記する。
5. 秘密情報が含まれていないことを確認する。
6. 意味のあるcheckpointとしてcommit・pushする。

コミット例:

```text
chore(ai): checkpoint MANGAI work for handoff
```

## 終了条件

- 要求された変更が完了している。
- 関連する品質ゲートが成功している、または失敗理由が具体的に記録されている。
- 文書と実装の状態が一致している。
- 次の担当者が会話履歴なしで再開できる。
