# MANGAI Codex ⇄ Claude Code 引継ぎ台帳

## 0. 現在の優先タスク（M3-1 コマ修正候補生成、2026-08-01）

- Branch: `agent/manga-panel-revision-v1`
- Base: `agent/manga-continuity-review-v1`（Draft PR #96）
- Draft PR: [#97](https://github.com/team478a/manga/pull/97)
- Preview: `https://mangai-hub-staging-git-agent-manga-pa-2b4a4e-team478as-projects.vercel.app`
- 目的: 採用済みコマ画像を残したまま、気になる部分の修正候補を生成する
- 実装: 6修正preset、任意追加要望、元画像先頭参照、設定version継承、2〜4候補、非破壊レイヤー採用
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_PANEL_REVISION_V1.md`
- 注意: マスク付きInpaintingではなく、参照画像を使うガイド付きImage-to-Image
- 未実施: 実Provider生成、実ブラウザ確認、責任者承認、親PR #96後のマージ

---

## 0. 現在の優先タスク（M2-4 生成履歴の一貫性チェック、2026-08-01）

- Branch: `agent/manga-continuity-review-v1`
- Base: `agent/manga-reference-assets-v1`（Draft PR #95）
- Draft PR: [#96](https://github.com/team478a/manga/pull/96)
- Preview: `https://mangai-hub-staging-git-agent-manga-co-df707f-team478as-projects.vercel.app`
- 目的: 採用済み生成画像が人物・衣装・場所・小物・画風の現在設定と参照画像を継続使用しているか確認する
- 実装: 設定版・参照asset・Job追跡の照合、混在警告、ページ／設定修正導線
- DB: 新規migrationなし
- 詳細: `docs/cloud/MANGA_CONTINUITY_REVIEW_V1.md`
- 注意: v1は画像ピクセルを解析せず、見た目の一致を保証しない
- 状態: ローカル全品質ゲート、GitHub全CI、Vercel成功。責任者確認待ち
- 変更しない範囲: 成人向け、Desktop、Provider、Worker、Stripe、Marketplace

---

## 0. 現在の優先タスク（M2-3 参照画像・コマ明示割当、2026-08-01）

- Branch: `agent/manga-reference-assets-v1`
- Base: `agent/manga-generation-integration-v1`（Draft PR #94）
- 目的: 人物・画風・場所・小物の参照画像と明示割当を一般向けコマ生成へ安全に反映する
- 実装: 非公開asset関連付け、コマ割当、Job監査入力、短時間署名URL、BFL FLUX.2 multi-reference
- migration: `202608010001_cloud_visual_references.sql`
- 詳細: `docs/cloud/MANGA_VISUAL_REFERENCES_V1.md`
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace、自動参照昇格

---

## 0. 現在の優先タスク（一般向け漫画生成の統合、2026-07-31）

- Branch: `agent/manga-generation-integration-v1`
- Base: `feature/manga-canvas-mvp` (`ae1279e`)
- Draft PR: [#94](https://github.com/team478a/manga/pull/94)
- Preview: `https://mangai-hub-staging-git-agent-manga-ge-907c74-team478as-projects.vercel.app`
- 目的: PR #87〜#90の一般向け漫画生成機能を最新Cloud基盤へ安全に統合する
- 範囲: FLUXコマ生成、候補比較、レイヤー合成、原稿検査、作品進捗、
  キャラクター設定、画風・場所・小物設定
- 状態: ローカル品質ゲート、GitHub全CI、Vercel Preview成功。責任者確認待ち
- 詳細: `docs/cloud/MANGA_GENERATION_INTEGRATION_REPORT.md`
- 未実施: migration適用、実Provider有料生成、実ブラウザ確認、マージ
- 変更しない範囲: 成人向け、Desktop、Stripe、Marketplace

---

## 0. 現在の優先タスク（一般向けモニターWebマニュアル同期、2026-07-31）

- Branch: `codex/cloud-monitor-guide-sync-v1`
- Base: `feature/manga-canvas-mvp` (`ee6e2ca`、PR #92 merge後)
- 目的: モニターが現在の8工程と利用可能範囲を迷わず理解し、制作画面からいつでもマニュアルを開けるようにする
- 対象: `/dashboard/monitor/guide`、`/admin/general-monitors/guide`、Cloud共通サイドバー
- Draft PR: [#93](https://github.com/team478a/manga/pull/93)
- Preview: `https://mangai-hub-staging-git-codex-cloud-mo-eaf18e-team478as-projects.vercel.app`
- 状態: 実装・ローカル全品質ゲート・実装commitの全CI・Vercel成功、責任者確認待ち
- 変更しない範囲: DB、migration、認証、AI生成・保存ロジック、Feature Flag、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の利用入口修正、2026-07-31）

- Branch: `codex/cloud-workflow-entrypoints-v1`
- Base: `feature/manga-canvas-mvp` (`38c1481`、PR #91 merge後)
- 目的: 市場分析以外の実装済み工程を、共通メニューから実際に利用可能にする
- 対象: Cloud共通サイドバー、工程入口Route、利用者本人の進行先解決
- Draft PR: [#92](https://github.com/team478a/manga/pull/92)
- 状態: 実装・ローカル主要品質ゲート完了、CI・Vercel Preview確認中
- 変更しない範囲: DB、migration、AI生成・保存ロジック、成人向け境界、Desktop

---

## 0. 現在の優先タスク（一般向け制作工程の表示整理、2026-07-31）

- Branch: `codex/cloud-workflow-labels-v1`
- Base: `feature/manga-canvas-mvp` (`7eb783f`)
- 目的: 一般向けモニターへ、実装済み工程と準備中工程を誤解なく案内する
- 対象: Cloud共通サイドバー、Dashboard、`/creator`、シナリオ採用画面
- 状態: 実装・ローカル主要品質ゲート完了、Draft PR作成前
- 変更しない範囲: DB、API、認証、制作・保存ロジック、Feature Flag、Desktop

---

## 0. 現在の優先タスク（クラウド制作の日本語化・初回ガイド、2026-07-31）

- Branch: `codex/cloud-creator-ja-guide-v1`
- Base: `feature/manga-canvas-mvp` (`3d16839`)
- 目的: モニターが英語の内部用語に迷わず、新しい紫基調UI上で
  最初の制作操作を理解できるようにする
- 対象: `/creator`と関連する作品作成・構成・ゴミ箱・ページ編集
- 状態: 実装とローカル主要品質ゲート完了、Draft PR #85で確認中
- 変更しない範囲: DB、API契約、認証、制作・保存ロジック、Desktop

---

## 0. 現在の優先タスク（招待メール文面編集、2026-07-31）

- Branch: `codex/cloud-monitor-email-template-v1`
- Base: `feature/manga-canvas-mvp` (`506cf2b`)
- 目的: 管理画面からモニター招待メールの件名・本文を安全に変更する
- 管理画面: `/admin/general-monitors/email`
- migration: `202607310003_cloud_general_monitor_email_template.sql`
- 状態: 実装とローカル主要品質ゲート完了、Draft PR準備中

---

## 0. 現在の優先タスク（モニター操作の処理中表示、2026-07-31）

- Branch: `codex/cloud-action-pending-feedback-v1`
- Base: `feature/manga-canvas-mvp` (`6ebdbaa`)
- 目的: ボタンクリック直後に処理中表示を出し、無反応に見える状態と二重送信を防ぐ
- 対象: モニター招待・運用・設定・フィードバック・初回開始
- 変更範囲: 表示層のみ。Server Action、認証、DB、API、Desktopは変更しない
- Draft PR: [#83](https://github.com/team478a/manga/pull/83)
- Preview:
  `https://mangai-hub-staging-hvbsecmo4-team478as-projects.vercel.app`
- 状態: 実装、ローカル品質ゲート、全CI、Vercel Preview成功。責任者確認待ち

---

## 0. 現在の優先タスク（一般向けモニター本番統合、2026-07-31）

- Branch: `codex/cloud-monitor-production-v1`
- Base: `feature/manga-canvas-mvp`
- 本番URL: `https://app.mang-ai.com`
- 目的: 一般向けRelease 1〜6を約10名へ本番招待制で段階公開する
- 除外: Stripe、販売、Marketplace、成人向け公開、Desktop
- 状態: 統合済み、品質ゲートとDraft PR作成中
- 正本:
  [`cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md`](cloud/CLOUD_GENERAL_MONITOR_PRODUCTION_INTEGRATION.md)

成人向け市場分析・企画のコードが統合履歴に含まれても、Productionの成人向け
Feature Flagは未設定または`false`を必須とする。本番マージ、migration適用、
Feature Flag有効化、redeploy、実招待はDraft PRの全CIと責任者承認後に行う。

---

## 0. 現在の優先タスク（Release 2 AI企画提案・限定公開準備、2026-07-30）

- Branch: `codex/cloud-proposal-generation-v1`
- Base: `codex/cloud-research-ai-auto-ux-v1` (`a21fd94`)
- Draft PR: [#69](https://github.com/team478a/manga/pull/69)
- 目的: 完了した一般向け市場分析から3企画を生成・比較・選択し、シナリオ生成へ引き継ぐ
- 状態: 実装・限定公開前ハードニング・ローカル品質ゲート完了。更新Preview CIと責任者実機受入れ待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_PROPOSAL_GENERATION_V1.md`、`docs/cloud/CLOUD_RELEASE2_LIMITED_RELEASE_RUNBOOK.md`

管理画面で設定済みのOpenAI接続とSupabase Vaultを再利用する。APIキーをローカル・Vercelへ複製しない。成人向けReportを外部AIへ送信しない。

---

## 0. 現在の優先タスク（売れ筋優先・AIおまかせ市場分析、2026-07-30）

- Branch: `codex/cloud-research-ai-auto-ux-v1`
- Base: `codex/cloud-adult-planning-option-v1` (`58a18b9`)
- 目的: 簡単な希望だけで「今、どんな漫画が買われる可能性が高いか」を具体的に提示する
- 状態: local実装済み。migrationと管理者キー登録は責任者申告で完了。更新Preview実機E2E、責任者承認待ち
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_RESEARCH_AI_AUTO_UX_SPEC.md`

成人向け内容は外部AIへ送信しない。APIキーは通常テーブル、Client、URL、ログ、監査へ出さない。既存stacked PRをrebase、force push、Close、mergeしない。

---

## 0. 現在の優先タスク（成人向け企画ブリーフ、2026-07-29）

本節を、直後に残る成人向け市場分析と一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-planning-option-v1`
- Base: `codex/cloud-adult-research-option-v1` (`a9969ac`)
- 親Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- Draft PR: [#67](https://github.com/team478a/manga/pull/67)
- 目的: 成人向け市場分析を完了した許可利用者へ、外部AIを使わない企画ブリーフを機能単位権限付きで提供する
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-95f9df-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_PLANNING_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_PLANNING_IMPLEMENTATION_REPORT.md`

この段階では利用者入力の保存・履歴・再表示だけを提供する。成人向け文章・画像の自動生成、外部Provider送信、Stripe自動許可、作品公開・販売は行わない。migration適用とFeature Flag有効化は責任者承認まで禁止する。

---

## 0. 現在の優先タスク（成人向け市場分析オプション、2026-07-29）

本節を、直後に残る一般向けRelease 1統合記録より優先する。

- Branch: `codex/cloud-adult-research-option-v1`
- Base: `codex/cloud-release1-integration-v1` (`6491a7d`)
- 親Draft PR: [#65](https://github.com/team478a/manga/pull/65)
- Draft PR: [#66](https://github.com/team478a/manga/pull/66)
- 目的: 成人向け市場分析を購入者・管理者許可利用者へ提供できる許可制Cloudオプション
- 状態: 実装・全CI完了、Vercel Preview Ready、責任者の実機受入れ待ち
- Preview: `https://mangai-hub-staging-git-codex-cloud-ad-7158e2-team478as-projects.vercel.app`
- 正本: `docs/CURRENT_TASK.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_OPTION_SPEC.md`、`docs/cloud/CLOUD_ADULT_RESEARCH_IMPLEMENTATION_REPORT.md`

一般向け市場分析は成人向け権限に依存させない。成人向けの画像・本文生成、Stripe自動連携、作品公開・販売は対象外。migration適用、Feature Flag有効化、DB Kill Switch有効化、本番公開は責任者承認まで行わない。

---

## 0. 現在の優先タスク（2026-07-29）

過去の引継ぎ記録より本節を優先する。

- Branch: `codex/cloud-release1-integration-v1`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- Draft PR: [#65](https://github.com/team478a/manga/pull/65)
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
