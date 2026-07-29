# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（Release 5ローカル実装・品質ゲート完了、外部E2E待ち）
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-manga-mvp`（Draft PR #53）
- Branch: `codex/cloud-work-management-mvp`
- Release 1 Draft PR: [#50](https://github.com/team478a/manga/pull/50)
- Release 2 Draft PR: [#51](https://github.com/team478a/manga/pull/51)
- Release 3 Draft PR: [#52](https://github.com/team478a/manga/pull/52)
- Release 4 Draft PR: [#53](https://github.com/team478a/manga/pull/53)
- Release 5 Draft PR: [#54](https://github.com/team478a/manga/pull/54)
- 計画: [`docs/cloud/CLOUD_WORK_MANAGEMENT_RELEASE_PLAN.md`](cloud/CLOUD_WORK_MANAGEMENT_RELEASE_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_WORK_MANAGEMENT_MVP_SPEC.md`](cloud/CLOUD_WORK_MANAGEMENT_MVP_SPEC.md)

## 目的

一般向けCloud ProjectをPage単位で確認し、公開・販売へ渡す前の状態を整理・承認できるRelease 5の縦型機能を完成させる。

## 実装済み

- `CLOUD_WORK_MANAGEMENT_MVP_ENABLED`（未設定時fail closed）
- 一般向けCloud Projectの作品管理一覧・詳細
- Page単位の現行revision確認と500文字メモ
- 作品名、説明、表紙、1〜200Page、Canvas保存、全Page確認、実行中Jobの公開前チェック
- `draft` → `review_ready` → `approved`の段階遷移
- `approved`は`review_ready`からのみ許可
- Project revision更新時の承認自動失効
- 所有者RLSと、利用者のtable直接更新禁止
- revision競合、別利用者、成人向けProjectの拒否
- マンガ生成詳細から作品管理への導線
- 承認後だけRelease 6準備完了を表示
- PostgreSQL実動作テストをCI migration roundtripへ追加
- migration／rollback／canonical schema／manifest
- 計画・仕様文書

## 重要な設計判断

- Release 5は既存Cloud Projectを正本とし、作品情報やCanvasを複製しない。
- Page確認時のrevisionを保存し、再編集後の古い確認を無効として扱う。
- Project revision変更triggerで公開前確認・承認を`draft`へ戻す。
- 公開・`works`／`digital_products`作成、PDF exportはRelease 6へ残す。
- Canvas Editor、Cloud AI、Stripe、Marketplace、Desktopは変更しない。
- Release 1〜4の外部E2E未完了は解除せず、Release 5をstacked branchで先行している。

## 検証

- Hub全テスト: PASS（165/165）
- 作品管理focused test: PASS（5/5）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop、Desktop変更なし）
- migration検証: PASS（21件）
- PostgreSQL migration往復／canonical schema検査: PASS
- PostgreSQL作品管理動作テスト: PASS
- production build: PASS
- 外部環境E2E: 未実施

## 外部環境待ち

1. Release 1〜5 migrationを対象Supabaseへ順番に適用
2. Vercelで`CLOUD_RESEARCH_MVP_ENABLED=true`
3. Vercelで`CLOUD_PROPOSAL_MVP_ENABLED=true`
4. Vercelで`CLOUD_SCENARIO_MVP_ENABLED=true`
5. Vercelで`CLOUD_MANGA_MVP_ENABLED=true`
6. Vercelで`CLOUD_WORK_MANAGEMENT_MVP_ENABLED=true`
7. 市場分析 → 企画 → シナリオ → マンガ下書き → Creator編集 → Page確認 → 承認の実ブラウザE2E
8. 別利用者RLS、revision失効、段階遷移、200ページ上限の確認
9. 390px／768px／1280px受入れ
10. 全CIと責任者承認

## 禁止事項

- `feature/manga-canvas-mvp`への直接push／merge
- Draft PR #50〜#54の外部ゲート未完了扱いの解除
- 既存migrationの変更
- Cloud AI Queue／Worker／Provider Gateway、Canvas Editor本体、Stripe、Marketplace、Desktopへの変更
- 成人向けコンテンツのCloud処理
- 全CI・外部E2E・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_WORK_MANAGEMENT_RELEASE_PLAN.md`
7. `docs/cloud/CLOUD_WORK_MANAGEMENT_MVP_SPEC.md`
