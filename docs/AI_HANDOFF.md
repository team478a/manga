# MANGAI Codex → Claude Code 引継ぎ台帳

## 1. 引継ぎ情報

- 引継ぎ作成日: 2026-07-25
- リポジトリ: `team478a/manga`
- デフォルトブランチ: `feature/manga-canvas-mvp`
- デフォルト基準コミット: `27d678bfbae2be0f8fc69b165b3532748a3bcaee`
- Codex最終作業ブランチ: `codex/pr-23-hub-structured-logging`
- Codex最終コミット: `0910919e37904245b80e26e4c495893da6234a9e`
- Claude Code引継ぎブランチ: `handoff/codex-to-claude-20260725`
- 差分状態: デフォルトブランチより15コミット先行、behind 0
- 現在状態: `READY_FOR_CLAUDE_CODE`

このブランチは最新のCodex作業ブランチから分岐しています。デフォルトブランチから開始すると、2026-07-24の保守性改善PRスタックが含まれないため注意してください。

## 2. 製品構成

| 製品 | 主な配置 | 責務 |
| --- | --- | --- |
| MANGAI Hub / Cloud | リポジトリルート、`src/` | 一般漫画制作、Project/Canvas、認証、公開、販売、Stripe、管理 |
| MANGAI Desktop | `apps/desktop/` | Windowsローカル制作、成人向け制作、Ollama、ComfyUI、書き出し、更新 |
| 共通Domain | `packages/` | Canvas、AI、Project、Export、IPC schema等の共通処理 |
| Hub DB | `supabase/` | PostgreSQL、RLS、Storage、migration |

製品方針は、一般漫画をCloud、成人向け漫画をDesktopで扱う分離構成です。成人向け処理と人物・参照画像・完成Pageはローカル優先・fail-closedを維持します。

## 3. Codexで完了した保守性改善スタック

2026-07-24時点で、保守性改善PR-01〜PR-23の実装は完了しています。GitHub上では以下がDraft PR #14〜#28として積み上がっています。

| GitHub PR | 改善段階 | 主な内容 |
| --- | --- | --- |
| #14 | PR-09 | Desktop SQLite MigrationRunner、事前backup、rollback |
| #15 | PR-10 | Database facade、Asset Repository/File Service、Backup分割 |
| #16 | PR-11 | AI service、Generation Router、Queue、Retry Policy分割 |
| #17 | PR-12 | Cloud Canvas Editorのhook/service分割 |
| #18 | PR-13 | Cloud Creator ServerのProject/Canvas/Asset等モジュール分割 |
| #19 | PR-14 | Hub Server Actionsの機能別分割、Storage補償transaction |
| #20 | PR-15 | package公開API、依存方向、循環参照、deep import検査 |
| #21 | PR-16 | Cloud Canvas Domain Error契約 |
| #22 | PR-17 | Cloud AI Domain Error契約 |
| #23 | PR-18 | Episode/Page Structure Domain Error契約 |
| #24 | PR-19 | Cloud Project/Asset/Import/Export Domain Error契約 |
| #25 | PR-20 | Checkout/Billing/Desktop API Domain Error契約 |
| #26 | PR-21 | Stripe Webhook/Purchase Download Domain Error契約 |
| #27 | PR-22 | Hub Server Action Domain Error契約 |
| #28 | PR-23 | Hub Structured Logging、request相関ID、redaction |

PR #28のbaseはPR #27のheadであり、同様に古いPRへ連なるstacked構造です。個別PRを独立PRとして扱わず、原則として#14から古い順に確認します。

## 4. 最新実装の品質証跡

PR #28作成時点の記録:

- Hub test: 110/110
- Canvas core: 26/26
- AI core: 44/44
- Desktop integration: 98/98
- TypeScript: 成功
- ESLint: 成功
- dependency boundary checks: 成功
- Supabase migration static validation: 16件成功
- Hub直接`console.*`再走査: 0件
- `git diff --check`: 成功

未確認またはGitHub CIで確認する項目:

- Hub製品build
- Desktop製品build
- Supabase migration roundtrip
- Windows実機関連試験

引継ぎ後は、上記記録を無条件に信用せず、現在branchで再実行できる品質ゲートを再実行してください。

## 5. Claude Codeが最初に行うこと

```bash
git fetch origin
git checkout handoff/codex-to-claude-20260725
git pull origin handoff/codex-to-claude-20260725
npm install

git status --short
git log --oneline --decorate -25
git diff feature/manga-canvas-mvp...HEAD --stat
```

その後、以下を読みます。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/CURRENT_TASK.md`
4. `docs/REMAINING_TASKS.md`
5. `docs/PROJECT_STATUS_AND_ROADMAP.md`
6. `docs/IMPLEMENTATION_HISTORY.md`
7. 各PRで追加された設計文書

最初の技術作業は、新機能追加ではなくstacked Draft PRの整合確認です。

1. PR #14〜#28のbase/head順を確認する。
2. 各PRのCI・mergeability・差分範囲を確認する。
3. 古い順で、互換entrypoint、migration、Domain Error、loggingの非回帰を確認する。
4. 問題があれば、そのPRのheadから修正ブランチを作るか、該当PR branchへ小さな修正を追加する。
5. mergeは利用者または責任者の明示指示があるまで実行しない。

## 6. 現在の次工程

`docs/REMAINING_TASKS.md`による現在の次工程:

1. stacked Draft PRを古い順にレビュー・CI確認・統合する。
2. hosting環境決定後、Hub Structured Loggingのlog sink、alert通知先、保持期間、担当者を設定する。
3. Supabase stagingへmigrationを適用し、Desktop端末認証を確認する。
4. Stripe test決済、失敗、返金、download E2Eを実施する。
5. 実Ollama、実ComfyUI、承認済みDezgo safe素材試験を実施する。
6. Windowsコード署名、署名済み自動更新、クリーンPC受入れを実施する。

外部環境や契約が必要な作業を、mockや静的確認だけで完了扱いにしないでください。

## 7. 外部環境待ち・責任者判断待ち

| 項目 | 状態 | 必要条件 |
| --- | --- | --- |
| Windows実署名 | BLOCKED | 信頼されたコード署名証明書 |
| 署名付き更新E2E | BLOCKED | 署名済み2version、公開更新URL |
| クリーンWindows受入れ | BLOCKED | Windows VMまたは新規PC |
| Ollama実環境E2E | BLOCKED | Ollama、対象モデル |
| ComfyUI実環境E2E | BLOCKED | ComfyUI、モデル、workflow JSON |
| Dezgo実API E2E | BLOCKED | BYOK key、課金承認、safe素材条件 |
| Supabase staging | BLOCKED | staging DB、接続情報、`psql` |
| Stripe E2E | BLOCKED | Stripe test、Webhook endpoint |
| Hub公開確認 | BLOCKED | Vercel/Supabase/Stripe本番設定 |
| log sink/alert | DECISION_REQUIRED | hosting、通知先、保持期間、担当者 |

## 8. 壊してはいけない境界

- `feature/manga-canvas-mvp`へ直接pushしない。
- Draft PR stackを一括rebase、force push、squashしない。
- 既存migrationを書き換えない。
- API responseの互換フィールドを削除しない。
- Desktop IPC schema、backup version、Project保存形式を無断変更しない。
- `MangaiDatabase`、`service.ts`、`actions.ts`等の互換entrypointを利用箇所確認前に削除しない。
- Domain Errorを生のError message判定へ戻さない。
- 未知例外、Supabase error詳細、Stripe error、token、Prompt、画像、メールをクライアントやlogへ露出しない。
- 成人向け、人物、参照画像、完成Pageの外部送信制限を緩和しない。

## 9. 標準品質ゲート

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

環境依存で実行できない項目は、コマンド、error、必要環境を`docs/CURRENT_TASK.md`へ記録します。

## 10. Codexへ戻す場合

Claude Codeの利用上限または作業区切りでCodexへ戻す場合:

1. 新規変更を開始しない。
2. `docs/CURRENT_TASK.md`を更新する。
3. `docs/HANDOFF_LOG.md`へ追記する。
4. テスト結果と未完了項目を記録する。
5. 小さなcheckpoint commitを作成し、現在branchへpushする。
6. Codexへ次の指示を渡す。

```text
AGENTS.md、CLAUDE.md、docs/AI_HANDOFF.md、docs/CURRENT_TASK.md、
docs/HANDOFF_LOG.mdを読み、git status、直近25コミット、
feature/manga-canvas-mvpとの差分を確認してください。
CURRENT_TASK.mdの未完了項目から継続し、完了済み変更を作り直さないでください。
```
