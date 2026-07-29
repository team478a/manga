# MANGAI Codex ⇄ Claude Code 引継ぎ台帳

## 0. 現在の優先タスク（2026-07-29）

過去の引継ぎ記録より本節を優先する。

- Branch: `codex/cloud-release1-integration-v1`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- 目的: 市場分析だけを限定公開できるRelease 1統合
- 統合元: PR #50、#56〜#62
- 除外: PR #48〜#49、#51〜#55、#63〜#64
- 状態: 公開前ハードニングと全品質ゲートを実行中。merge・本番反映は禁止
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RELEASE1_INTEGRATION_REPORT.md`、`docs/cloud/CLOUD_RELEASE1_BETA_ACCEPTANCE.md`

既存PRは統合元としてそのまま保持し、rebase、force push、Closeを行わない。以下の節は保守性改善・Desktop作業時点の履歴として残す。

## 1. 引継ぎ情報

- 更新日: 2026-07-26
- リポジトリ: `team478a/manga`
- デフォルトブランチ: `feature/manga-canvas-mvp`
- デフォルト最新コミット: `c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`（`Merge pull request #32 from team478a/codex/creator-workflow`）
- 保守性改善統合ブランチ: `integration/maintenance-stack-20260726`
- 統合PR: **#34**（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`、Draft、mergeable、責任者レビュー待ち）
- デザイン仕様PR: **#33**（`design/mangai-ui-refresh` → `handoff/codex-to-claude-20260725`、Draft、文書のみ）
- 現在状態: `READY_FOR_REVIEW`（PR #34のレビュー・マージ判断待ち）

**この文書が正本です。会話履歴・過去のセッション要約を正本として扱わないでください。**

## 2. 製品構成

| 製品 | 主な配置 | 責務 |
| --- | --- | --- |
| MANGAI Hub / Cloud | リポジトリルート、`src/` | 一般漫画制作、Project/Canvas、認証、公開、販売、Stripe、管理 |
| MANGAI Desktop | `apps/desktop/` | Windowsローカル制作、成人向け制作、Ollama、ComfyUI、書き出し、更新 |
| 共通Domain | `packages/` | Canvas、AI、Project、Export、IPC schema等の共通処理 |
| Hub DB | `supabase/` | PostgreSQL、RLS、Storage、migration |

製品方針は、一般漫画をCloud、成人向け漫画をDesktopで扱う分離構成です。成人向け処理と人物・参照画像・完成Pageはローカル優先・fail-closedを維持します。

## 3. 現在のブランチ構造

```text
feature/manga-canvas-mvp (デフォルト)
  ├─ PR #30〜#32: Vercel workspace package build修正、パスワード確認・再設定フロー、
  │                Creatorプロフィール・作品アップロード安全性強化（merge済み）
  │
  ├─ integration/maintenance-stack-20260726 (Draft PR #34)
  │    保守性改善PR #14〜#28（15コミット、stacked）をcherry-pickし、
  │    PR #30〜#32の機能と統合済み。責任者レビュー・マージ判断待ち。
  │
  └─ handoff/codex-to-claude-20260725
       └─ design/mangai-ui-refresh (Draft PR #33)
            「MANGAI Creative Studio」デザイン仕様（docs/design/配下、文書のみ）
            責任者が方向性を承認済み。画面別「デザイン承認条件」は未了。
```

PR #14〜#28（元のstacked Draft PR、`codex/pr-09-desktop-migration-runner`〜`codex/pr-23-hub-structured-logging`）は、PR #34への統合作業の元データとしてそのまま残存しています。個別にmerge・rebase・closeはしていません。

## 4. 保守性改善スタックの統合状況（PR #34）

2026-07-24時点で完了していた保守性改善PR-01〜PR-23（GitHub Draft PR #14〜#28）を、2026-07-26に`feature/manga-canvas-mvp`の最新状態へ統合しました。

- 統合方法: 古い順に1コミットずつ`git cherry-pick`（一括cherry-pickではない）
- 競合: 3件（`src/app/actions.ts`＝PR#19、`package.json`＝PR#20、`src/app/actions/{auth,profile,work}-actions.ts`＝PR#27）。いずれも分割構造（薄い互換entrypoint＋機能別ファイル）を採用しつつ、PR #30〜#32由来の新機能（パスワード確認、sharp画像形式検証、旧画像Storage削除等）を保持する形で解決
- 品質ゲート: lint/typecheck/deps:check/hub:test(116/116)/canvas:test(26/26)/ai:test(44/44)/desktop:test(98/98)/migration検証/Hub build/Desktop build/rc:preflight/git diff --check、すべてPASS
- CI（PR #34）: Required Quality PASS、Migration roundtrip PASS、Desktop Windows PASS（Accessibility testsを含む）、Vercel Preview Ready

詳細・競合解決の判断根拠は[`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](../docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)を参照してください。

## 5. Claude Code / Codexが最初に行うこと

```bash
git fetch origin
git checkout integration/maintenance-stack-20260726
git pull origin integration/maintenance-stack-20260726

git status --short
git log --oneline --decorate -15
git diff feature/manga-canvas-mvp...HEAD --stat
```

その後、以下を読みます。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`（本ファイル）
4. `docs/CURRENT_TASK.md`
5. `docs/HANDOFF_LOG.md`
6. 対象機能の設計文書

## 6. 現在の次工程

1. PR #34の責任者レビュー・マージ判断を待つ（本ブランチでの新規変更は、レビュー指摘への対応以外は行わない）。
2. PR #34が`feature/manga-canvas-mvp`へmergeされたら、PR #33（`docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`）のビジュアル仕様承認（§4各画面末尾・§8）が揃っているか確認する。
3. 上記2点が揃った時点で、**merge後の最新`feature/manga-canvas-mvp`から新しい実装ブランチを作成**し、Phase D1（デザイントークン導入）へ着手する。`design/mangai-ui-refresh`をそのまま実装ブランチとして流用しない。
4. hosting環境決定後、Hub Structured Loggingのlog sink、alert通知先、保持期間、担当者を設定する。
5. Supabase stagingへmigrationを適用し、Desktop端末認証を確認する。
6. Stripe test決済、失敗、返金、download E2Eを実施する。
7. 実Ollama、実ComfyUI、承認済みDezgo safe素材試験を実施する。
8. Windowsコード署名、署名済み自動更新、クリーンPC受入れを実施する。

外部環境や契約が必要な作業を、mockや静的確認だけで完了扱いにしないでください。

## 7. 外部環境待ち・責任者判断待ち

| 項目 | 状態 | 必要条件 |
| --- | --- | --- |
| Desktop Accessibility（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT | Xサーバー（ディスプレイ）を持つ実行環境。GitHub ActionsのDesktop Windows workflowでは`npm run test:a11y`が成功済み |
| Vercel Preview deployment | PASS（CI確認済み） | ― |
| Vercel本番環境の通し受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Vercel/Supabase/Stripe本番設定 |
| Windows実署名 | BLOCKED_EXTERNAL_ENVIRONMENT | 信頼されたコード署名証明書 |
| 署名付き更新E2E | BLOCKED_EXTERNAL_ENVIRONMENT | 署名済み2version、公開更新URL |
| クリーンWindows受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | Windows VMまたは新規PC |
| Ollama実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Ollama、対象モデル |
| ComfyUI実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | ComfyUI、モデル、workflow JSON |
| Dezgo実API E2E | BLOCKED_EXTERNAL_ENVIRONMENT | BYOK key、課金承認、safe素材条件 |
| Supabase staging | BLOCKED_EXTERNAL_ENVIRONMENT | staging DB、接続情報、`psql` |
| Stripe E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Stripe test、Webhook endpoint |
| log sink/alert | DECISION_REQUIRED | hosting、通知先、保持期間、担当者 |
| Desktopブランドカラー・テーマ・Tailwind非移行 | 確定済み（責任者指示、2026-07-26） | ― |
| Hubの配色・ダークモード方針 | DECISION_REQUIRED | Desktopデザイン確定後に判断（`docs/design/DESIGN_SYSTEM.md`§5） |

## 8. 壊してはいけない境界

- `feature/manga-canvas-mvp`へ直接pushしない。
- PR #34、PR #33を無断でrebase、force push、squashしない。
- 既存migrationを書き換えない。
- API responseの互換フィールドを削除しない。
- Desktop IPC schema、backup version、Project保存形式を無断変更しない。
- `MangaiDatabase`、`service.ts`、`actions.ts`等の互換entrypointを利用箇所確認前に削除しない。
- Domain Errorを生のError message判定へ戻さない。
- 未知例外、Supabase error詳細、Stripe error、token、Prompt、画像、メールをクライアントやlogへ露出しない。
- 成人向け、人物、参照画像、完成Pageの外部送信制限を緩和しない。
- `design/mangai-ui-refresh`（PR #33）でUIコード・CSS・Reactコンポーネントを変更しない。

## 9. 標準品質ゲート

```bash
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

環境依存で実行できない項目は、コマンド、error、必要環境を`docs/CURRENT_TASK.md`へ記録します。`desktop:test:a11y`はローカルの実行可否とGitHub Actions Windows CIの結果を区別して記録してください。

## 10. Codex ⇄ Claude Code間で引き継ぐ場合

利用上限または作業区切りで引き継ぐ場合:

1. 新規変更を開始しない。
2. `docs/CURRENT_TASK.md`を更新する。
3. `docs/HANDOFF_LOG.md`へ追記する。
4. テスト結果と未完了項目を記録する。
5. 小さなcheckpoint commitを作成し、現在branchへpushする。
6. 次の担当者へ以下の指示を渡す。

```text
AGENTS.md、CLAUDE.md、docs/AI_HANDOFF.md、docs/CURRENT_TASK.md、
docs/HANDOFF_LOG.mdを読み、git status、直近15コミット、
feature/manga-canvas-mvpとの差分を確認してください。
CURRENT_TASK.mdの未完了項目から継続し、完了済み変更を作り直さないでください。
```
