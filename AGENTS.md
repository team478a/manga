# MANGAI Agent Instructions

このファイルはCodexを含む開発AI向けの共通作業規約です。会話履歴ではなく、GitHub上のコード・文書・コミットを正本として扱ってください。

## 最初に確認する順番

1. `CLAUDE.md`
2. `docs/AI_HANDOFF.md`
3. `docs/CURRENT_TASK.md`
4. `docs/REMAINING_TASKS.md`
5. `docs/PROJECT_STATUS_AND_ROADMAP.md`
6. `docs/IMPLEMENTATION_HISTORY.md`
7. `docs/architecture/OVERVIEW.md`
8. 対象領域の`docs/desktop/`または`docs/hub/`配下の文書

## 作業開始時の必須確認

```bash
git status --short
git branch --show-current
git log --oneline --decorate -20
git diff feature/manga-canvas-mvp...HEAD --stat
```

現在の引継ぎ基点は`handoff/codex-to-claude-20260725`です。このブランチは`codex/pr-23-hub-structured-logging`の先端から作成されています。

## 基本ルール

- `docs/CURRENT_TASK.md`に記載された範囲だけを進める。
- 完了済みの実装を別方式で作り直さない。
- 既存API、DB、Storage、Desktop IPC、保存形式の後方互換を壊さない。
- 大規模な一括変更を避け、レビュー可能な単位でコミットする。
- 新しい仕様判断が必要な場合は、実装で先回りせず`docs/CURRENT_TASK.md`の未決事項へ記録する。
- `.env*`、APIキー、署名鍵、認証情報、利用者コンテンツをコミットしない。
- Prompt、画像、成人向けコンテンツ、個人情報をログへ出力しない。
- 外部AI Providerへの送信は既存の明示承認、分類、費用上限、fail-closed方針を維持する。
- 成人向け処理はローカル優先を維持し、明示承認なしに外部送信経路を有効化しない。
- Supabase migrationの既存履歴を変更・削除しない。追加時は冪等性、checksum、rollbackを確認する。
- stacked Draft PRを無断でrebase、squash、base変更、mergeしない。
- CodexとClaude Codeが同じブランチを同時編集しない。

## 品質ゲート

変更範囲に応じて以下を実行し、結果を`docs/CURRENT_TASK.md`と`docs/HANDOFF_LOG.md`へ記録してください。

```bash
npm install
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run db:migrations:validate
npm run build
npm run desktop:build
```

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
