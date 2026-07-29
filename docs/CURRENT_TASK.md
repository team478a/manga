# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Release 0＋Release 1実装・ローカル品質ゲート完了、Draft PR #50のCI・外部E2E待ち）
- リポジトリ: `team478a/manga`
- Base: `origin/feature/manga-canvas-mvp` (`7615d06`)
- Branch: `codex/cloud-research-mvp`
- Draft PR: [#50](https://github.com/team478a/manga/pull/50)
- 計画: [`docs/cloud/CLOUD_WORKFLOW_RELEASE_PLAN.md`](cloud/CLOUD_WORKFLOW_RELEASE_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_RESEARCH_MVP_SPEC.md`](cloud/CLOUD_RESEARCH_MVP_SPEC.md)

## 目的

MANGAI Cloudを市場分析から始まる制作ワークフロー順に公開する。広範なCloud UI刷新より先に、市場分析の入力・実行・保存・履歴・再表示を完走させる。

## 今回の範囲

### Release 0

- 最小限のCloud共通シェル
- ワークフロー順の左サイドバー
- Dashboard
- 現在の制作進行
- `CLOUD_RESEARCH_MVP_ENABLED` Feature Flag

### Release 1

- 市場分析の必須入力
- HTTPS出典URL、取得日時、確認事実
- 定性的な分析実行
- Report保存
- 履歴
- Report再表示
- 完了後だけ有効なAI企画提案への引継ぎ導線

## 実装方針

- Release 1は`research-rules-v1`で証拠に基づく定性的整理を行う。
- 根拠のない市場規模、販売数、成長率を生成しない。
- 全分析項目を`fact`または`ai_inference`へ区分する。
- 任意URLのServer-side取得は行わず、利用者が確認した出典を保存する。
- 成人向け区分は入力必須だが、既存のCloud／Desktop境界によりCloud実行を拒否する。
- Reportはimmutable。修正は新規Reportとして作成する。

## 変更しない範囲

- Cloud Canvas Editor
- Cloud AI Worker
- Stripe
- Marketplace
- Desktop
- シナリオ生成
- マンガ生成
- 販売準備
- 収益ダッシュボード

## 現在の検証

- lint: PASS
- typecheck: PASS（Hub + Desktop、Desktopコード変更なし）
- 市場分析単体・構造テスト: PASS（5/5）
- hub:test: PASS（121/121）
- deps:check: PASS
- migration検証: PASS（17件）
- build: PASS
- git diff --check: PASS

## 未完了

1. Supabase対象環境へ新規migrationを適用
2. Vercel Previewで入力・保存・履歴・再表示E2E
3. CIと責任者承認

## 禁止事項

- `feature/manga-canvas-mvp`への直接push
- 既存migrationの変更
- Cloud AI Worker、Canvas、Stripe、Marketplace、Desktopへの変更
- 根拠のない市場数値の生成
- 入力・保存・履歴・再表示が完走する前のmerge
- 全CI成功・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_WORKFLOW_RELEASE_PLAN.md`
7. `docs/cloud/CLOUD_RESEARCH_MVP_SPEC.md`
